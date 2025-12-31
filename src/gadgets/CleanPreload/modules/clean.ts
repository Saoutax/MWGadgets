function clean(content: string) {
    return content.replace(/<!--[\s\S]*?-->/g, "");
}

export default clean;
