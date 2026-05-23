declare module '*.scss';

declare namespace oouiDialog {
    function confirm($content: JQuery<HTMLElement>, config: { title: string; size: string }): Promise<boolean>;
    function alert(message: string, config: { title: string; size: string }): Promise<void>;
    function sanitize(text: string): string;
}

declare namespace hashwasm {
    function sha3(input: string, bits: 256 | 384 | 512): Promise<string>;
}
