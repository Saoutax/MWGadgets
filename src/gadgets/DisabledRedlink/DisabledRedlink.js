$(function() {
    $('a[href*="action=edit"][href*="redlink=1"]').each(function() {
        $(this).attr("href", function(_, href) {
            return href
                .replace(/([&?])(action=edit|redlink=1)/g, "$1")
                .replace(/\?&/, "?")
                .replace(/&&+/g, "&")
                .replace(/[?&]$/, "");
        });
    });
});