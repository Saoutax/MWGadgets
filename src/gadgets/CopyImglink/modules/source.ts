import { getContent } from '@/utils/getContent';

const sourceURL = async () => {
    const content = await getContent();
    const regex = /\bhttps?:\/\/[^\s<>"]+\.(?:png|jpe?g|gif|svg|webp)/gi;

    const result = new Set<string>();
    for (const url of content.match(regex) || []) {
        result.add(url);
    }

    return result;
};

export { sourceURL };
