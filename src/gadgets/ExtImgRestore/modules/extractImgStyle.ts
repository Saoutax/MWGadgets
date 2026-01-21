function extractImgStyle(content: string, src: string, index: number): string {
    const regex = new RegExp(`<img[^>]*src=["']${src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`, "gi");
    const matches = [...content.matchAll(regex)];
    const targetMatch = matches[index]?.[0] || null;

    if (!targetMatch) {
        return "";
    }

    const styleMatch = targetMatch.match(/style=["']([^"']+)["']/i);
    return styleMatch?.[1] || "";
}

export { extractImgStyle };
