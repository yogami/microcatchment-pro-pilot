// React import removed

interface NadirSpiritLevelProps {
    deviationX: number; // -1 to 1
    deviationY: number; // -1 to 1
    isAligned: boolean;
}

export function NadirSpiritLevel({ deviationX, deviationY, isAligned }: NadirSpiritLevelProps) {

    return (
        <div className="flex flex-col items-center justify-center">
            {/* Target Circle */}
            <div className={`relative w-24 h-24 border-2 rounded-full flex items-center justify-center transition-colors duration-300 ${isAligned ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10'}`}>

                {/* Crosshairs */}
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/5 -translate-y-1/2" />
                <div className="absolute left-1/2 top-0 w-px h-full bg-white/5 -translate-x-1/2" />

                {/* Central Deadzone */}
                <div className={`w-4 h-4 rounded-full border transition-all duration-300 ${isAligned ? 'border-emerald-500 bg-emerald-500/40 scale-110 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'border-white/20'}`} />

                {/* Floating Bubble */}
                <div
                    className={`absolute w-3 h-3 rounded-full transition-all duration-100 ease-out shadow-lg ${isAligned ? 'bg-emerald-400 opacity-0' : 'bg-amber-500 shadow-amber-500/30'}`}
                    style={{
                        transform: `translate(${deviationX * 36}px, ${deviationY * 36}px)`,
                    }}
                />
            </div>

            <p className={`mt-3 text-[9px] font-black uppercase tracking-[0.2em] transition-colors ${isAligned ? 'text-emerald-500' : 'text-amber-500 animate-pulse'}`}>
                {isAligned ? 'Alignment Locked' : 'Nadir Alignment Out'}
            </p>
        </div>
    );
}
