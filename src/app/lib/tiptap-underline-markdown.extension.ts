import Underline from '@tiptap/extension-underline';

/**
 * With `tiptap-markdown` and `html: false`, marks without a `storage.markdown.serialize`
 * spec fall back to the internal "HTMLMark" serializer, which outputs nothing for
 * non-HTML mode — so underline was dropped on `getMarkdown()`. This mirrors the
 * `++text++` format from `@tiptap/extension-underline` / `tiptap-markdown` tokenizers.
 */
export const UnderlineWithMarkdown = Underline.extend({
  addStorage() {
    return {
      markdown: {
        serialize: {
          open: '++',
          close: '++',
          expelEnclosingWhitespace: true,
        },
      },
    };
  },
});
