
const OPENROUTER_KEY = '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';
const MODELS = [
    'x-ai/grok-4.1-fast',
    'openai/gpt-5.2',
    'openai/o3',
    'deepseek/deepseek-v3.2'
];

const PROBLEM_STATEMENT = `
### TECHNICAL AUDIT CHALLENGE: The Rail-Anchor Protocol (RAP)

#### CONTEXT:
We are building a High-Veracity spatial auditing tool for Microcatchments using standard consumer smartphones (iPhone/Android). 
The Target: Centimeter-level accuracy for small areas (2-10m²) in "GPS-Dark" environments (indoors, dense tree cover, urban canyons).

#### THE LOCALIZATION STACK (RAP):
1. **Inertial Engine**: Pure double-integration of linear acceleration (gravity removed). 
2. **Drift Control (ZUPT)**: Zero-Velocity Update triggered when |accel| < 0.08m/s².
3. **Ghost Plan Relocation**: The first manual 'Snap' to a physical landmark (e.g., bed corner) translates the entire digital map (Screen 1) to the current local coordinate system.
4. **Magnetic Rail Snapping (The "Slot-Car" Manifold)**: User movement is projected onto the nearest edge of the pre-defined Map-Boundary if the distance is < 1.0m. 
5. **Segment Scale Handshake**: The system calculates the 'Real Meters' per 'Sensor Unit' between every manual Snap, auto-correcting the scale for the next segment.

#### YOUR TASK:
As a Senior Sensor Fusion & SLAM Engineer, perform an ADVERSARIAL AUDIT. 
1. **Identify the 'Deadly Sin'**: Where does the double-integration fail first on a $1,000 phone with standard MEMS IMUs?
2. **Edge Cases**: What happens if the user's hand rotates? (Gimbal lock, orientation bias, coordinate frame rotation).
3. **Flaw Detection**: Is 'Magnetic Rail Snapping' dangerous for veracity? Does it hide real measurement errors or physical misalignments?
4. **Suggestions**: Propose a 'Loop Closure' or 'Visual-Inertial' tweak that is computationally cheap for a WebGL browser environment.
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
                'X-Title': 'Microcatchment Pro Adversarial Audit'
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an adversarial Senior SLAM Engineer. Your goal is to find the flaws in proposed localization architectures. Be direct, technical, and skeptical. Use 2026-era knowledge of sensor fusion.'
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.1
            })
        });

        const data = await response.json();
        if (data.error) {
            return `ERROR from OpenRouter: ${JSON.stringify(data.error)}`;
        }
        return data.choices?.[0]?.message?.content || JSON.stringify(data);
    } catch (error: any) {
        return `ERROR calling ${model}: ${error.message}`;
    }
}

async function runAudit() {
    let report = `# Solution Audit Report - ${new Date().toISOString()}\n\n`;
    report += `## Input Problem & Solution\n\n${PROBLEM_STATEMENT}\n\n`;

    for (const model of MODELS) {
        const result = await callOpenRouter(model, PROBLEM_STATEMENT);
        report += `## Audit Result: ${model}\n\n${result}\n\n---\n\n`;
    }

    const fs = await import('fs');
    fs.writeFileSync('scripts/validation/AUDIT_REPORT_2026.md', report);
    console.log('Audit completed. Report saved to scripts/validation/AUDIT_REPORT_2026.md');
}

runAudit();
