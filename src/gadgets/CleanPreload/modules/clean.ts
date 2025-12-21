import content from "./get.js";

async function clean() {
    return content.replace(/<!--[\s\S]*?-->/g, "");
}

export default await clean();
