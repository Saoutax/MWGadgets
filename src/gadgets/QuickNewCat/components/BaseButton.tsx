import type { FunctionalComponent } from "preact";

const BaseButton: FunctionalComponent<{
    text: string;
    onClick: () => void;
    type?: "button" | "submit";
}> = ({ text, onClick, type = "button" }) => {
    return (
        <span
            className={
                "oo-ui-widget oo-ui-widget-enabled oo-ui-inputWidget " +
                "oo-ui-buttonElement oo-ui-buttonElement-framed " +
                "oo-ui-labelElement oo-ui-flaggedElement-primary " +
                "oo-ui-flaggedElement-progressive oo-ui-buttonInputWidget"
            }
        >
            <button type={type} className={"oo-ui-inputWidget-input oo-ui-buttonElement-button"} onClick={onClick}>
                <span className={"oo-ui-labelElement-label"}>{text}</span>
            </button>
        </span>
    );
};

export { BaseButton };
