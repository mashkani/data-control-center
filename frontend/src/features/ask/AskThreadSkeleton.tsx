import { CardSkeleton } from '@/components/ui/skeleton'

export function AskThreadSkeleton() {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-3 p-3" data-testid="ask-thread-skeleton">
      <CardSkeleton />
      <CardSkeleton />
    </div>
  )
}
