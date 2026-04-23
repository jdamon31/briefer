'use client'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { ALL_TAGS, TAG_COLORS, ItemTag } from '@/types'
import { cn } from '@/lib/utils'

interface TagPickerPopoverProps {
  currentTag: ItemTag | undefined
  onSelect: (tag: ItemTag) => void
}

export function TagPickerPopover({ currentTag, onSelect }: TagPickerPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors cursor-pointer',
          currentTag
            ? TAG_COLORS[currentTag]
            : 'bg-zinc-700 text-zinc-400 border-zinc-600 hover:border-zinc-400'
        )}
      >
        {currentTag || 'tag'}
      </PopoverTrigger>
      <PopoverContent className="w-48 bg-zinc-800 border-zinc-700 p-2" align="start">
        <div className="flex flex-wrap gap-1.5">
          {ALL_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => onSelect(tag)}
              className={cn(
                'text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer',
                TAG_COLORS[tag],
                currentTag === tag && 'ring-1 ring-white/30'
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
