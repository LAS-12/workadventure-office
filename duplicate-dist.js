import fs from 'fs';
import path from 'path';

const distDir = 'dist';
const nestedDir = path.join(distDir, 'dist');

if (fs.existsSync(distDir)) {
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
