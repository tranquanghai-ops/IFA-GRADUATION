/**
 * IFA+ Graduation — UI Helpers & Modal Layers Module
 */
export function initUIHelpers() {
  if (typeof window !== 'undefined') {
    console.log('[IFA Graduation] UI helpers ready');
  }
}
window.initUIHelpers = initUIHelpers;

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof initUIHelpers !== 'undefined') window.initUIHelpers = initUIHelpers;
}
