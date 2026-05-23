(() => {
    const { wgRestrictionEdit, wgRestrictionMove, wgRevisionId, wgArticleId, wgIsProbablyEditable } = mw.config.get();

    if ((wgRevisionId === 0 && wgArticleId === 0) || !(wgRestrictionEdit && wgRestrictionMove)) {
        return;
    }

    const protectText = (type: string[] | undefined) => {
        const protect = type ? type[0] : '';
        switch (protect) {
            case 'sysop':
                return ' [Sysop]';
            case 'patrolleredit':
                return ' [Patroller]';
            case 'techedit':
                return ' [Techeditor]';
            case 'extendedconfirmed':
                return ' [Eextendedconfirmed]';
            case 'autoconfirmed':
                return ' [Autoconfirmed]';
            default:
                return '';
        }
    };

    if (wgRestrictionEdit) {
        const editButton = wgIsProbablyEditable
            ? document.querySelector('#ca-edit a')
            : document.querySelector('#ca-viewsource a');
        editButton!.insertAdjacentHTML('beforeend', protectText(wgRestrictionEdit));
    }

    if (wgRestrictionMove) {
        const moveButton = document.querySelector('#ca-move a') as HTMLAnchorElement;
        moveButton.insertAdjacentHTML('beforeend', protectText(wgRestrictionMove));
    }
})();
