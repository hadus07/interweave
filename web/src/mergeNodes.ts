import type { Node, XYPosition } from '@xyflow/react'
import type { FileCardData } from '~shared/canvas'

export type CardHandlers = Pick<FileCardData, 'onExpand' | 'onShowSource' | 'onRemove'>

// Merge freshly-projected nodes over the previous render: keep prior position and
// measured size for surviving cards (so an expand doesn't reset the laid-out
// canvas) and (re)inject the card callbacks, which projectGraph leaves undefined.
// Brand-new nodes have no prior position (projectGraph seeds them at 0,0); when an
// expand supplies an anchor, fan them out from the expanded card so they emerge
// from under it instead of piling at the origin. Pass 2 then lays them out properly.
export function mergeNodes(
  prev: Node<FileCardData>[],
  next: Node<FileCardData>[],
  handlers: CardHandlers,
  anchorPath?: string | null,
): Node<FileCardData>[] {
  const prevById = new Map(prev.map((n) => [n.id, n]))
  const anchor = anchorPath ? prevById.get(anchorPath)?.position : undefined
  let fresh = 0
  return next.map((n) => {
    const old = prevById.get(n.id)
    let position: XYPosition
    if (old) position = old.position
    else if (anchor) position = { x: anchor.x + 24 * ++fresh, y: anchor.y + 24 * fresh }
    else position = n.position
    return {
      ...n,
      position,
      measured: old?.measured ?? n.measured,
      data: { ...n.data, ...handlers },
    }
  })
}
