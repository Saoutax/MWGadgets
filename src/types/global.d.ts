declare module '*.scss';

declare namespace hashwasm {
    function sha3(input: string, bits: 256 | 384 | 512): Promise<string>;
}
