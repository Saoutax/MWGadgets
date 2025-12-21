import content from "./get.js";

function clean() {
    return content.replace(/<!--[\s\S]*?-->/g, "");
}

export default clean();
