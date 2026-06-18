import { ChevronsDownUp, ChevronsUpDown, File, Folder } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '../lib/cn'
import { type TreeNode, buildTree, descendantFiles } from '../lib/treeBuilder'

interface Props {
  paths: string[]
  excluded: Set<string>
  activePath?: string | null
  onSetExcluded: (files: string[], exclude: boolean) => void
  onSeed: (path: string) => void
}

function folderPaths(nodes: TreeNode[]): string[] {
  return nodes.flatMap((n) => (n.isFile ? [] : [n.path, ...folderPaths(n.children)]))
}

function fullyExcludedFolders(nodes: TreeNode[], excluded: Set<string>): string[] {
  return nodes.flatMap((n) =>
    n.isFile || descendantFiles(n).some((f) => !excluded.has(f))
      ? n.isFile
        ? []
        : fullyExcludedFolders(n.children, excluded)
      : [n.path],
  )
}

export default function FileTree({ paths, excluded, activePath, onSetExcluded, onSeed }: Props) {
  const tree = buildTree(paths)
  // ponytail: seed once from the restored exclusions; user toggles take over after.
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(fullyExcludedFolders(tree, excluded)),
  )

  const collapseAll = () => setCollapsed(new Set(folderPaths(tree)))
  const expandAll = () => setCollapsed(new Set())

  // Reveal the selected file: drop any collapsed folder that is its ancestor.
  useEffect(() => {
    if (!activePath) return
    setCollapsed((prev) => {
      const next = new Set([...prev].filter((p) => !activePath.startsWith(`${p}/`)))
      return next.size === prev.size ? prev : next
    })
  }, [activePath])
  function onToggle(path: string, open: boolean) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (open) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const iconBtnClass =
    'inline-flex items-center justify-center w-7 h-7 p-0 border border-strong rounded-md bg-elevated text-muted cursor-pointer transition-colors duration-120 hover:text-accent-hover hover:border-accent'

  return (
    <div className="px-1 pb-2">
      <div className="sticky top-0 z-1 flex justify-end px-2 pt-3 pb-1.5 mb-1 border-b border-border bg-sidebar gap-1">
        <button type="button" className={iconBtnClass} title="Expand all" onClick={expandAll}>
          <ChevronsUpDown size={15} />
        </button>
        <button type="button" className={iconBtnClass} title="Collapse all" onClick={collapseAll}>
          <ChevronsDownUp size={15} />
        </button>
      </div>
      {tree.map((node) => (
        <Row
          key={node.path}
          node={node}
          depth={0}
          collapsed={collapsed}
          onToggle={onToggle}
          excluded={excluded}
          activePath={activePath}
          onSetExcluded={onSetExcluded}
          onSeed={onSeed}
        />
      ))}
    </div>
  )
}

function FileRow({
  node,
  depth,
  excluded,
  activePath,
  onSetExcluded,
  onSeed,
}: {
  node: TreeNode
  depth: number
  excluded: Set<string>
  activePath?: string | null
  onSetExcluded: Props['onSetExcluded']
  onSeed: Props['onSeed']
}) {
  const isExcluded = excluded.has(node.path)
  const isActive = node.path === activePath
  const iconColor = isActive ? 'text-accent-hover' : 'text-muted'
  const labelColor = isActive
    ? 'text-accent-active'
    : isExcluded
      ? 'text-faint line-through cursor-default hover:text-faint'
      : 'text-secondary'
  const checkOpacity = isActive ? 'opacity-100' : ''
  return (
    <div
      className={cn(
        'group flex items-center gap-1.5 px-1 py-0.5 rounded cursor-default whitespace-nowrap',
        isActive && 'bg-accent-wash shadow-[inset_2px_0_0_var(--iw-accent)]',
      )}
      style={indent(depth)}
      ref={(el) => {
        isActive && el?.scrollIntoView({ block: 'nearest' })
      }}
    >
      <span className={cn('inline-flex items-center justify-center shrink-0 w-3.5', iconColor)}>
        <File size={13} />
      </span>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: label seeds a card, keyboard is via the canvas */}
      <span
        className={cn(
          'cursor-pointer overflow-hidden text-ellipsis flex-1 min-w-0 hover:text-accent-hover',
          labelColor,
        )}
        onClick={() => !isExcluded && onSeed(node.path)}
      >
        {node.name}
      </span>
      <input
        type="checkbox"
        checked={!isExcluded}
        className={cn(
          'ml-auto shrink-0 w-3.5 h-3.5 cursor-pointer m-0 accent-accent transition-opacity duration-120 opacity-30 group-hover:opacity-100',
          checkOpacity,
        )}
        onChange={() => onSetExcluded([node.path], !isExcluded)}
      />
    </div>
  )
}

const ICON_WIDTH = 14
const ICON_GAP = 6
const INDENT_STEP = ICON_WIDTH + ICON_GAP
const indent = (depth: number) => ({ paddingLeft: 4 + depth * INDENT_STEP })

function Row({
  node,
  depth,
  collapsed,
  onToggle,
  excluded,
  activePath,
  onSetExcluded,
  onSeed,
}: {
  node: TreeNode
  depth: number
  collapsed: Set<string>
  onToggle: (path: string, open: boolean) => void
} & Omit<Props, 'paths'>) {
  if (node.isFile) {
    return (
      <FileRow
        node={node}
        depth={depth}
        excluded={excluded}
        activePath={activePath}
        onSetExcluded={onSetExcluded}
        onSeed={onSeed}
      />
    )
  }

  const files = descendantFiles(node)
  const includedCount = files.filter((f) => !excluded.has(f)).length
  const allIncluded = includedCount === files.length
  const someIncluded = includedCount > 0 && !allIncluded
  const fullyExcluded = includedCount === 0

  return (
    <details
      open={!collapsed.has(node.path)}
      onToggle={(e) => onToggle(node.path, e.currentTarget.open)}
    >
      <summary
        className="group flex items-center gap-1.5 px-1 py-0.5 rounded cursor-default whitespace-nowrap list-none"
        style={indent(depth)}
      >
        <span className="inline-flex items-center justify-center shrink-0 w-3.5 text-muted">
          <Folder size={13} />
        </span>
        <span
          className={cn(
            'overflow-hidden text-ellipsis flex-1 min-w-0',
            fullyExcluded ? 'text-faint line-through cursor-default' : 'text-muted cursor-default',
          )}
        >
          {node.name}
        </span>
        <input
          type="checkbox"
          checked={allIncluded}
          ref={(el) => {
            if (el) el.indeterminate = someIncluded
          }}
          className="ml-auto shrink-0 w-3.5 h-3.5 cursor-pointer m-0 accent-accent transition-opacity duration-120 opacity-30 group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
          onChange={() => {
            onSetExcluded(files, allIncluded)
            if (allIncluded) onToggle(node.path, false) // deselecting → fold
          }}
        />
      </summary>
      {node.children.map((child) => (
        <Row
          key={child.path}
          node={child}
          depth={depth + 1}
          collapsed={collapsed}
          onToggle={onToggle}
          excluded={excluded}
          activePath={activePath}
          onSetExcluded={onSetExcluded}
          onSeed={onSeed}
        />
      ))}
    </details>
  )
}
