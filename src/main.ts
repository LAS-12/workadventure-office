/// <reference types="@workadventure/iframe-api-typings" />

import { bootstrapExtra } from "@workadventure/scripting-api-extra";

console.info('WorkAdventure Office Script started');

let myAssignedDesk: number | null = null;
let isSittingAtDesk: number | null = null;
let insideMeetingRoom = false;
let currentActionMessage: any = null;

// Sound synthesizer using Web Audio API for zero-latency, reliable Ding-Dong sound
function playDingDong() {
    try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        // "Ding" (higher tone: ~880 Hz / A5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, now);
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.4, now + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.8);

        // "Dong" (lower tone: ~659.25 Hz / E5)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659.25, now + 0.35);
        gain2.gain.setValueAtTime(0, now + 0.35);
        gain2.gain.linearRampToValueAtTime(0.5, now + 0.4);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.35);
        osc2.stop(now + 1.4);
    } catch (e) {
        console.warn('Audio play error:', e);
    }
}

function clearActionMessage() {
    if (currentActionMessage) {
        try {
            currentActionMessage.remove();
        } catch (_) {}
        currentActionMessage = null;
    }
}

WA.onInit().then(async () => {
    console.info('Scripting API ready');

    // Setup 10 Desks
    for (let i = 1; i <= 10; i++) {
        const deskId = i;

        // Seat listener (when the user sits down at the desk)
        WA.room.area.onEnter(`desk_seat_${deskId}`).subscribe(() => {
            isSittingAtDesk = deskId;
            myAssignedDesk = deskId;
            clearActionMessage();
            try {
                WA.controls.disablePlayerProximityMeeting();
            } catch (_) {}
            try {
                WA.chat.sendChatMessage(`💼 Você sentou na Mesa ${deskId} (Modo Foco Ativado: sem chamadas indevidas). Para conversar, levante da cadeira ou vá à sala de reunião!`, { scope: 'local' });
            } catch (_) {}
        });

        WA.room.area.onLeave(`desk_seat_${deskId}`).subscribe(() => {
            if (isSittingAtDesk === deskId) {
                isSittingAtDesk = null;
                try {
                    WA.controls.restorePlayerProximityMeeting();
                } catch (_) {}
            }
        });

        // Bell listener (when someone walks up to the desk to call)
        WA.room.area.onEnter(`desk_bell_${deskId}`).subscribe(() => {
            // Don't show ring prompt to the person who is already sitting there
            if (isSittingAtDesk === deskId) {
                return;
            }

            clearActionMessage();
            currentActionMessage = WA.ui.displayActionMessage({
                message: `Pressione ESPAÇO para tocar a campainha da Mesa ${deskId} 🔔`,
                callback: () => {
                    ringDesk(deskId);
                }
            });
        });

        WA.room.area.onLeave(`desk_bell_${deskId}`).subscribe(() => {
            clearActionMessage();
        });
    }

    // Meeting Room Doorbell
    WA.room.area.onEnter('doorbell_meeting').subscribe(() => {
        if (insideMeetingRoom) return;
        clearActionMessage();
        currentActionMessage = WA.ui.displayActionMessage({
            message: "Pressione ESPAÇO para tocar a campainha da Sala de Reunião 🔔",
            callback: () => {
                ringMeetingRoom();
            }
        });
    });

    WA.room.area.onLeave('doorbell_meeting').subscribe(() => {
        clearActionMessage();
    });

    // Track if user is in Meeting Room
    WA.room.area.onEnter('jitsiMeetingRoom').subscribe(() => {
        insideMeetingRoom = true;
    });

    WA.room.area.onLeave('jitsiMeetingRoom').subscribe(() => {
        insideMeetingRoom = false;
    });

    // Listen to broadcast events
    WA.event.on('ring_desk').subscribe((event) => {
        const data = event.data as { deskId: number; caller: string } | undefined;
        if (!data) return;

        const { deskId, caller } = data;
        const playerName = WA.player.name || "Você";

        // Is this my desk?
        if (myAssignedDesk === deskId) {
            playDingDong();
            try {
                WA.ui.banner.openBanner({
                    id: `ring-${deskId}-${Date.now()}`,
                    text: `🔔 ${caller} está chamando você na sua Mesa ${deskId}!`,
                    bgColor: "#1d4ed8",
                    textColor: "#ffffff",
                    closable: true,
                    timeToClose: 8000
                });
            } catch (_) {}
            try {
                WA.chat.sendChatMessage(`🔔 [Campainha] ${caller} está chamando na sua Mesa ${deskId}!`, { scope: 'local' });
            } catch (_) {}
        } else if (caller !== playerName) {
            // General notification for other team members
            try {
                WA.chat.sendChatMessage(`🔔 ${caller} tocou a campainha da Mesa ${deskId}.`, { scope: 'local' });
            } catch (_) {}
        }
    });

    WA.event.on('ring_meeting').subscribe((event) => {
        const data = event.data as { caller: string } | undefined;
        if (!data) return;

        const { caller } = data;
        if (insideMeetingRoom) {
            playDingDong();
            try {
                WA.ui.banner.openBanner({
                    id: `meeting-${Date.now()}`,
                    text: `🔔 ${caller} está chamando na porta da Sala de Reunião!`,
                    bgColor: "#047857",
                    textColor: "#ffffff",
                    closable: true,
                    timeToClose: 8000
                });
            } catch (_) {}
            try {
                WA.chat.sendChatMessage(`🔔 [Porta] ${caller} tocou a campainha da Sala de Reunião!`, { scope: 'local' });
            } catch (_) {}
        }
    });

    // Bootstrap extra features
    bootstrapExtra().catch(e => console.error(e));
}).catch(e => console.error(e));

function ringDesk(deskId: number) {
    playDingDong();
    const caller = WA.player.name || "Um colega";
    WA.event.broadcast('ring_desk', { deskId, caller }).catch(e => console.error(e));
    try {
        WA.chat.sendChatMessage(`🔔 Você tocou a campainha da Mesa ${deskId}!`, { scope: 'local' });
    } catch (_) {}
}

function ringMeetingRoom() {
    playDingDong();
    const caller = WA.player.name || "Um colega";
    WA.event.broadcast('ring_meeting', { caller }).catch(e => console.error(e));
    try {
        WA.chat.sendChatMessage(`🔔 Você tocou a campainha da Sala de Reunião!`, { scope: 'local' });
    } catch (_) {}
}

export {};
