import type { FunctionalComponent } from "preact";
import { ActionButton } from "./ActionButton";
import { InputButton } from "./InputButton";
import { work, character, music, vup, real, author } from "./create";

const UI: FunctionalComponent = () => {

    return (
        <div
            className="oo-ui-layout oo-ui-panelLayout oo-ui-panelLayout-padded oo-ui-panelLayout-framed"
            style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: "24px",
            }}
        >
            <span style={{ margin: 0, fontWeight: "bold", fontSize: "1.4em" }}>
                快速创建分类页
            </span>
            <div
                style={{
                    display: "flex",
                    gap: "16px",
                    alignItems: "center",
                    flexWrap: "wrap",
                }}
            >
                <ActionButton text="{{作品}}" onAction={work} />
                <ActionButton text="{{作品中角色}}" onAction={character} />
                <ActionButton text="{{作品中音乐}}" onAction={music} />
                <ActionButton text="{{虚拟角色/虚拟UP主}}" onAction={vup} />
                <InputButton text="{{现实人物}}" onAction={real} />
                <InputButton text="	{{作者分类}}" onAction={author} />
            </div>
        </div>
    );
};

export { UI };
