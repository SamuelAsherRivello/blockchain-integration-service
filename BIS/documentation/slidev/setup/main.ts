import type { AppContext } from '@slidev/types'

function openSlideLinksInNewTabs(root: ParentNode = document) {
  if (root instanceof HTMLAnchorElement && root.closest('#slide-content')) {
    root.target = '_blank'
    root.rel = 'noopener noreferrer'
  }

  root.querySelectorAll<HTMLAnchorElement>('#slide-content a[href]').forEach((link) => {
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
  })
}

export default function setupSlideLinkTargets(_context: AppContext) {
  openSlideLinksInNewTabs()

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element)
          openSlideLinksInNewTabs(node)
      }
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
}
