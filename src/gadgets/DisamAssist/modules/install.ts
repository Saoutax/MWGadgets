import { shouldLoad } from './check';
import { start } from './start';

const install = async () => {
    if (!shouldLoad()) {
        return;
    }
    await mw.loader.using(['mediawiki.Title', 'mediawiki.api', 'mediawiki.util']);
    start();
};

export { install };
