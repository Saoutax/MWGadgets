"use strict";
$(() => {
    function bytecount(text) {
        // eslint-disable-next-line no-control-regex
        text = text.replace(/[\u0000-\u007F]/g, ".");
        text = text.replace(/[\u0080-\u07FF\uD800-\uDFFF]/g, "..");
        text = text.replace(/[\u0800-\uD7FF\uE000-\uFFFF]/g, "...");
        return text.length;
    }
    function cjkcount(text) {
        text = text.replace(/\./g, "");
        text = text.replace(/[\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u3005\u3007\u3021-\u3029\u3038-\u303B\u3400-\u4DB5\u4E00-\u9FCC\uF900-\uFA6D\uFA70-\uFAD9]|[\uD840-\uD868][\uDC00-\uDFFF]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|[\uD86A-\uD86C][\uDC00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D]|\uD87E[\uDC00-\uDE1D]/g, ".");
        text = text.replace(/[^.]/g, "");
        return text.length;
    }
    function getwcbytext(text) {
        return `${text.length}字符（${cjkcount(text)}个CJK字符）<br />${bytecount(text)}字节（UTF-8编码）`;
    }
    function getsel() {
        if (!window.getSelection) { return ""; }
        return getSelection().toString();
    }
    function dowc() {
        $(".wordcount").remove();
        const text = getsel();
        if (text.length === 0) { return; }
        const divj = $("<div>").html(getwcbytext(text))
            .css({
                position: "fixed",
                left: "50%",
                bottom: "20px",
                transform: "translateX(-50%)",
                margin: "6px",
                padding: "8px",
                color: "whitesmoke",
                background: "rgba(0, 123, 255, 0.65)",
                border: "transparent",
                "z-index": "100",
            })
            .addClass("wordcount ui-state-highlight ui-corner-all")
            .appendTo("body");
        setTimeout(() => {
            divj.fadeOut("slow");
        }, 6666);
    }
    $(document).mouseup(dowc).keyup(dowc);
});
