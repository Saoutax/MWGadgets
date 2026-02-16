import type { FunctionalComponent } from "preact";
import { BaseButton } from "./BaseButton";

const ActionButton: FunctionalComponent<{
    text: string;
    onAction: () => void;
}> = ({ text, onAction }) => {
    return <BaseButton text={text} onClick={onAction} />;
};

export { ActionButton };
