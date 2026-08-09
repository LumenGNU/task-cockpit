

type Code = 'duplicate labels' | 'missing dependency';

interface RawDiagnostic {
    code: Code,
    message: string;
    position: { offset: number; length: number; };
}

export default RawDiagnostic;
