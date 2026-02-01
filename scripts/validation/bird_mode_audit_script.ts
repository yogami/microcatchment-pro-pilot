
const OPENROUTER_KEY = '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';
const MODELS = [
    'x-ai/grok-4.1-fast',
    'openai/gpt-5.2',
    'openai/o3',
    'deepseek/deepseek-v3.2'
];

const BIRD_MODE_PITCH = `
### STRATEGIC AUDIT: "The Bird-on-a-Budget" (Bird-Mode V3)

#### PROPOSAL:
Strap a consumer smartphone (running Microcatchment Pro V3) to the belly of a $500 consumer drone (e.g., DJI Mini). 
Fly at ultra-low altitude (3m - 6m / 10ft - 20ft) over micro-catchment areas.
The drone's gimbal and internal sensors maintain level flight; our phone's V3 (Optical Flow + IMU) tracks the $XY$ displacement.

#### ADVANTAGES:
1. **Scale Stability**: Unlike handheld "Hand-Sweep," the drone maintains a near-constant Z-height ($h \approx 4m$). This removes the "Scale Ambiguity" variable from the EKF.
2. **Speed**: Can cover 2m/s vs 0.5m/s (walking).
3. **Ghost-GNSS Utility**: In "Banned" or "GPS-Denied" zones (urban canyons/forests), the drone stays level via its TOF sensors, while our phone provides the "Veracity Map" via VIAP.

#### ADVERSARIAL QUESTIONS:
1. **The Vibration Problem**: High-frequency motor vibration (150Hz+) vs our 100Hz smartphone IMU. Does this "poison" the double-integration faster than human hand-tremor?
2. **The "Banned Zone" Risk**: What are the legal/commercial liabilities of encouraging "10ft-altitude" flights in restricted urban zones to bypass LiDAR professional costs?
3. **The Accuracy Ceiling**: Can a 6m-altitude optical flow track a featureless floor better or worse than a 1m-altitude handheld sweep?
4. **Is it a LiDAR-Killer?**: Does this provide enough detail for stormwater inverts (curb heights) compared to a $100k LiDAR rig?
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
                'X-Title': 'Bird Mode V3 Audit'
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: 'You are a Senior Aerospace & SLAM Engineer known for "killing" bad startup ideas. Evaluate this "Phone-on-Drone" tactic for flaws.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.1
            })
        });
        const data = await response.json();
        return data.choices?.[0]?.message?.content || JSON.stringify(data);
    } catch (error: any) {
        return `ERROR: ${error.message}`;
    }
}

async function runBirdAudit() {
    let report = `# BIRD MODE V3 AUDIT REPORT - ${new Date().toISOString()}\n\n`;
    for (const model of MODELS) {
        const result = await callOpenRouter(model, BIRD_MODE_PITCH);
        report += `### Review: ${model}\n\n${result}\n\n---\n\n`;
    }
    const fs = await import('fs');
    fs.writeFileSync('scripts/validation/BIRD_MODE_AUDIT.md', report);
    console.log('Bird Mode Audit completed. Report saved to scripts/validation/BIRD_MODE_AUDIT.md');
}

runBirdAudit();
