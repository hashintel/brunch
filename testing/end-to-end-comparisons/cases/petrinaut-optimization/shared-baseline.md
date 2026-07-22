# Shared baseline: Petrinaut optimization

The repository contains Petrinaut's editor, scenarios, parameter schemas, saved and custom metrics, and a
pre-existing optimizer API/client protocol. These capabilities are available to inspect and reuse; adding
the optimization user interface is the implementation task.

The public mechanical address is the Petrinaut website's `/optimization` route. Its browser calls a
same-origin API path which may proxy to a separately configured optimizer. The upstream optimizer origin
must not appear in browser requests or rendered content.

The execution scope is one frontend feature in the full repository. It does not require the authenticated
HASH application shell, an extracted Petrinaut repository, or a new optimizer backend.
