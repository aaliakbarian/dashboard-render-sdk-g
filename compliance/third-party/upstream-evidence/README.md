# Checked-in upstream evidence

These files fill evidence gaps in the installed npm artifacts. They are copied
verbatim so the licensing gate can run offline. The generator records each
file's SHA-256 again in the machine inventory.

| Component | Verbatim file | Authoritative source | Revision | SHA-256 |
| --- | --- | --- | --- | --- |
| `dangerously-set-html-content@1.1.1` | `dangerously-set-html-content-1.1.1/package.json` | <https://raw.githubusercontent.com/christo-pr/dangerously-set-html-content/8b0977bbadde76c24e38ebde72ab988ae3ad1426/package.json> | `8b0977bbadde76c24e38ebde72ab988ae3ad1426` | `93e7d31f281691c0da8eee971728c612c566ca3088780d283beb6ba7f38f327b` |
| `string-hash@1.1.3` | `string-hash-1.1.3/README.md` | <https://raw.githubusercontent.com/darkskyapp/string-hash/cb38ab492aba198b9658b286bb2391278bb6992b/README.md> | `cb38ab492aba198b9658b286bb2391278bb6992b` | `1fa7fa0cabcb33619f1693a09c569a31ee6544333686e8b664a3c98e1c5346d9` |
| `toggle-selection@1.0.6` | `toggle-selection-1.0.6/package.json` | <https://raw.githubusercontent.com/sudodoki/toggle-selection/466460c75ca40630d8de940490718247fce79a3e/package.json> | `466460c75ca40630d8de940490718247fce79a3e` | `fbde858ede9465c03e5270332090684350327e360760d185b2ed4fc3aff73f15` |

The package manifests are authoritative upstream declarations, not locally
invented full license texts. The `dangerously-set-html-content` declaration is
not treated as sufficient release evidence: neither the npm artifact nor the
exact referenced upstream commit contains a license file with complete MIT
terms, so the generated inventory records an explicit release-blocking review
decision. `toggle-selection` is installed-only; its declaration is retained as
provenance without adding it to distributed notices.
