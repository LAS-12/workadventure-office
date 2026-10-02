import fs from 'fs';
import path from 'path';

const distDir = 'dist';

if (fs.existsSync(distDir)) {
    // 1. Normalize all backslashes in all .tmj and .json files in dist
    for (const file of fs.readdirSync(distDir)) {
        if (file.endsWith('.tmj') || file.endsWith('.json')) {
            const filePath = path.join(distDir, file);
            let content = fs.readFileSync(filePath, 'utf8');
            content = content.replace(/assets\\\\/g, 'assets/').replace(/assets\\/g, 'assets/');
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Normalized slashes in ${filePath}`);
        }
    }

    // 2. Mirror into nested dist directory
    const nestedDir = path.join(distDir, 'dist');
    fs.mkdirSync(nestedDir, { recursive: true });
    for (const item of fs.readdirSync(distDir)) {
        if (item === 'dist') continue;
        const src = path.join(distDir, item);
        const dst = path.join(nestedDir, item);
        fs.cpSync(src, dst, { recursive: true });
    }
    fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
    console.log('Successfully created nested dist and .nojekyll for complete path compatibility!');
}
