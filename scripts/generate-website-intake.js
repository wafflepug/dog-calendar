const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const endpoint = read('waffle-bootstrap.js').match(/const ENDPOINT = '([^']+)'/)[1];
const template = read('apps-script/Intake.html');
const marker = [
    'const INTAKE_TOKEN = <?!= JSON.stringify(intakeToken) ?>;',
    'const intakeTransport = { withSuccessHandler: handler => google.script.run.withSuccessHandler(handler) };',
    'const websiteIntake = false;'
].join('\n');
if (!template.includes(marker)) throw new Error('Could not locate the hosted intake transport.');
const bridge = "const websiteIntake = true;\nconst websiteIntakeEndpoint = \"__INTAKE_ENDPOINT__\";\n\nfunction websiteIntakeRunner(success, failure) {\n    async function request(operation, payload) {\n        try {\n            const response = await fetch(websiteIntakeEndpoint, {\n                method: 'POST',\n                body: new URLSearchParams({\n                    action: 'website_intake',\n                    payloadJson: JSON.stringify({ operation, ...payload })\n                }),\n                credentials: 'omit',\n                referrerPolicy: 'no-referrer',\n                cache: 'no-store'\n            });\n            const data = await response.json();\n            if (!response.ok || data.result === 'error') throw new Error(data.error || 'The intake request failed.');\n            success(data.value);\n        } catch (error) {\n            failure(error);\n        }\n    }\n    return {\n        withFailureHandler: handler => websiteIntakeRunner(success, handler),\n        getIntakePrefillForHtml: token => request('prefill', { token }),\n        getIntakeSubmissionStatusForHtml: (token, submissionId) => request('status', { token, submissionId }),\n        submitIntakeFromHtml: payload => request('submit', payload)\n    };\n}\nconst intakeTransport = { withSuccessHandler: handler => websiteIntakeRunner(handler, () => {}) };\nconst INTAKE_TOKEN = new URLSearchParams(location.hash.slice(1)).get('token') || '';".replace('__INTAKE_ENDPOINT__', endpoint);
const output = template.replace(marker, () => bridge);
if (process.argv.includes('--check')) {
    if (read('palz-intake.html') !== output) throw new Error('Run node scripts/generate-website-intake.js to sync the website intake.');
} else {
    fs.writeFileSync(path.join(root, 'palz-intake.html'), output);
}
