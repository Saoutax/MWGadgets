import { consoleError } from '@/utils/statusConsole';

const getGroups = async () => {
    const allUsers = [
        ...new Set(
            [...document.querySelectorAll<HTMLAnchorElement>('a.mw-userlink')]
                .map(a => decodeURIComponent(a.href.match(/\/User:([^/?#]+)/)?.[1] || ''))
                .filter(Boolean),
        ),
    ];
    try {
        const {
            query: { users },
        } = await new mw.Api().post({
            action: 'query',
            list: 'users',
            ususers: allUsers.join('|'),
            usprop: 'groups',
            formatversion: 2,
        });

        const result: Record<string, string[]> = {};
        for (const { name, groups } of users) {
            const notShow = ['*', 'autoconfirmed'],
                shouldShow = groups.filter((item: string) => !notShow.includes(item));
            if (shouldShow) {
                result[name] = shouldShow;
            }
        }

        return result;
    } catch (error) {
        consoleError('MarkRights', error);
    }
};

export { getGroups };
