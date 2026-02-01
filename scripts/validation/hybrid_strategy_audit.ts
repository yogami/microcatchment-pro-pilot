
const OPENROUTER_KEY = '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';
const MODELS = [
    'x-ai/grok-4.1-fast',
    'openai/gpt-5.2',
    'openai/o3',
    'deepseek/deepseek-v3.2'
];

const HYBRID_STRATEGY_PITCH = `
### STRATEGIC AUDIT: The "Nested Survey" Model
We are positioning Microcatchment Pro as a "Ground Truth" utility for LiDAR Drone Sweeps.

#### DATA SYNERGY:
1. **Drone (Macro)**: Provides 5-10cm RMSE global terrain model. 
2. **Handleheld RIAP (Micro)**: Provides 1-2cm relative precision for "Verification Windows" (critical stormwater intake points).
3. **Synthesis**: The Handheld VIAP data is used to "anchored" the Drone LiDAR cloud at high-risk vertices, effectively using the smartphone as a "Manual GCP" (Ground Control Point).

#### QUESTION FOR ADVERSARIAL AUDITORS:
1. Is smartphone VIAP data (with Rail-Anchor Protocol) trustworthy enough to act as a "Virtual Ground Control Point" for a $100k LiDAR Drone cloud?
2. Does this "Nested Survey" model provide a competitive moat against pure-drone mapping companies? 
3. Identify the commercial risk of "Data Incompatibility" between browser-based WebGL coordinates and professional GIS/LAS files.
`;

async function callOpenRouter(model: string, prompt: string) {
    console.log(`Calling ${model}...`);
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://berlinailabs.de',
                'X-Title': 'Hybrid LiDAR Audit'
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: 'You are a skeptical Geospatial Strategy Consultant. Evaluate the commercial and technical viability of this hybrid survey model.' },
                    { role: 'user', content: prompt }
                ]
            })
        });
        const data = await response.json();
        return data.choices?.[0]?.message?.content || JSON.stringify(data);
    } catch (error: any) {
        return `ERROR: ${error.message}`;
    }
}

async function runHybridAudit() {
    let report = `# HYBRID STRATEGY REVIEW - ${new Date().toISOString()}\n\n`;
    for (const model of MODELS) {
        const result = await callOpenRouter(model, HYBRID_STRATEGY_PITCH);
        report += `### Review: ${model}\n\n${result}\n\n---\n\n`;
    }
    const fs = await import('fs');
    fs.writeFileSync('scripts/validation/HYBRID_AUDIT_REPORT.md', report);
    console.log('Hybrid Audit completed. Report saved to scripts/validation/HYBRID_AUDIT_REPORT.md');
}

runHybridAudit();
