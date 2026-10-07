/// <reference types="@workadventure/iframe-api-typings" />

import { bootstrapExtra } from "@workadventure/scripting-api-extra";

console.info('WorkAdventure Office with 10 Cabins started');

let myAssignedCabin: number | null = null;
let isInsideCabin: number | null = null;
let insideMeetingRoom = false;
let currentActionMessage: any = null;

// Multi-method Doorbell Sound (Web Audio Synth + Audio element)
function playDingDong() {
    // 1. Web Audio Synth (zero latency)
    try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
            const ctx = new AudioCtx();
            if (ctx.state === 'suspended') {
                ctx.resume();
            }
            const now = ctx.currentTime;

            // "Ding" (higher tone: 880 Hz / A5)
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

            // "Dong" (lower tone: 659.25 Hz / E5)
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
        }
    } catch (e) {
        console.warn('Audio synth error:', e);
    }

    // 2. HTML5 Audio backup
    try {
        const audio = new Audio('doorbell.mp3');
        audio.play().catch(() => {});
    } catch (_) {}
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

    // Setup 10 Cabins
    for (let i = 1; i <= 10; i++) {
        const cabinId = i;

        // Inside cabin listener (Focus / Silent mode)
        WA.room.area.onEnter(`cabin_seat_${cabinId}`).subscribe(() => {
            isInsideCabin = cabinId;
            myAssignedCabin = cabinId;
            clearActionMessage();
            try {
                WA.controls.disablePlayerProximityMeeting();
            } catch (_) {}
            try {
                WA.controls.disableMicrophone();
            } catch (_) {}
            try {
                WA.chat.sendChatMessage(
                    `🔒 Você entrou na Cabine ${cabinId} (Modo Foco Ativado). Proximidade e microfone desativados para total privacidade. Se alguém tocar a campainha, você será avisado!`,
                    { scope: 'local' }
                );
            } catch (_) {}
        });

        WA.room.area.onLeave(`cabin_seat_${cabinId}`).subscribe(() => {
            if (isInsideCabin === cabinId) {
                isInsideCabin = null;
                try {
                    WA.controls.restorePlayerProximityMeeting();
                } catch (_) {}
                try {
                    WA.controls.restoreMicrophone();
                } catch (_) {}
                try {
                    WA.chat.sendChatMessage(
                        `🔓 Você saiu da Cabine ${cabinId}. Modo de comunicação restaurado.`,
                        { scope: 'local' }
                    );
                } catch (_) {}
            }
        });

        // Doorbell listener (in the corridor in front of cabin door)
        WA.room.area.onEnter(`cabin_bell_${cabinId}`).subscribe(() => {
            // Don't prompt occupant who is already inside
            if (isInsideCabin === cabinId) {
                return;
            }

            clearActionMessage();
            currentActionMessage = WA.ui.displayActionMessage({
                message: `Pressione ESPAÇO para tocar a campainha da Cabine ${cabinId} 🔔`,
                callback: () => {
                    ringCabin(cabinId);
                }
            });
        });

        WA.room.area.onLeave(`cabin_bell_${cabinId}`).subscribe(() => {
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

    // Meeting Room Track
    WA.room.area.onEnter('jitsiMeetingRoom').subscribe(() => {
        insideMeetingRoom = true;
    });

    WA.room.area.onLeave('jitsiMeetingRoom').subscribe(() => {
        insideMeetingRoom = false;
    });

    // Listen to cabin ring events
    WA.event.on('ring_cabin').subscribe((event) => {
        const data = event.data as { cabinId: number; caller: string } | undefined;
        if (!data) return;

        const { cabinId, caller } = data;
        const playerName = WA.player.name || "Você";

        // If I am inside or assigned to this cabin
        if (myAssignedCabin === cabinId || isInsideCabin === cabinId) {
            playDingDong();
            try {
                WA.ui.banner.openBanner({
                    id: `ring-cabin-${cabinId}-${Date.now()}`,
                    text: `🔔 ${caller} está chamando na porta da sua Cabine ${cabinId}!`,
                    bgColor: "#1d4ed8",
                    textColor: "#ffffff",
                    closable: true,
                    timeToClose: 8000
                });
            } catch (_) {}
            try {
                WA.chat.sendChatMessage(
                    `🔔 [Campainha] ${caller} tocou a campainha da sua Cabine ${cabinId}!`,
                    { scope: 'local' }
                );
            } catch (_) {}
        } else if (caller !== playerName) {
            try {
                WA.chat.sendChatMessage(
                    `🔔 ${caller} tocou a campainha da Cabine ${cabinId}.`,
                    { scope: 'local' }
                );
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
                WA.chat.sendChatMessage(
                    `🔔 [Porta] ${caller} tocou a campainha da Sala de Reunião!`,
                    { scope: 'local' }
                );
            } catch (_) {}
        }
    });

    bootstrapExtra().catch(e => console.error(e));
}).catch(e => console.error(e));

function ringCabin(cabinId: number) {
    playDingDong();
    const caller = WA.player.name || "Um colega";
    WA.event.broadcast('ring_cabin', { cabinId, caller }).catch(e => console.error(e));
    try {
        WA.chat.sendChatMessage(`🔔 Você tocou a campainha da Cabine ${cabinId}!`, { scope: 'local' });
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
