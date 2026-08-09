
import {
    MarkdownString
} from 'vscode';

// const EXPANDER = '\u00A0'.padEnd(36, '\u00A0');
// const EXPANDER = '.'.padEnd(36, '.');
const P = '\n\n';
const BR = '  \n';

const EXPANDER = '![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQ4AAAABAgMAAABS/qhXAAAACVBMVEUAAAAAAAD///+D3c/SAAAAAXRSTlMAQObYZgAAAAxJREFUCNdjYKACAAAARQABMOPaBgAAAABJRU5ErkJggg==)';

// [ *title*                ] (T)
// [                        ]
// [ **label**              ] (L)
// [ detail...              ] (D)
// [<-- tooltip expander -->] (EXP)
//
// аргументы	структура
// ----------------------------------------------------
// T + L + D	*T* [P] **L** [BR] D [BR] EXP
// T + L	    *T* [P] **L** [BR] EXP
// T + D	    *T* [P] D [BR] EXP
// L + D	    **L** [BR] D [BR] EXP
// T	        *T* [BR] EXP
// L	        **L** [BR] EXP
// D	        D [BR] EXP
// —	        undefined
function formatTooltip(
    title: string | undefined | null,
    label: string | undefined | null,
    detail: string | undefined | null
): MarkdownString | undefined {

    if (!title && !label && !detail) {
        return undefined;
    }

    const inner: string[] = [];
    if (label) { inner.push(`**${label}**`); }
    if (detail) { inner.push(detail); }

    const outer: string[] = [];
    if (title) { outer.push(`*${title}*`); }
    if (inner.length) { outer.push(inner.join(BR)); }

    const tooltip = new MarkdownString();
    tooltip.isTrusted = false;
    tooltip.supportHtml = false;
    tooltip.supportThemeIcons = true;

    tooltip.appendMarkdown(`${outer.join(P)}${BR}${EXPANDER}`);

    return tooltip;
}

export default formatTooltip;
