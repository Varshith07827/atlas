import { useMemo } from 'react'
import { useData } from '@/store/data'
import { inboxTasks } from '@/store/selectors'
import { Page } from '@/components/layout/AppShell'
import { InlineCapture } from '@/components/QuickAdd'
import { TaskList } from '@/components/task/TaskItem'
import { EmptyState } from '@/components/ui/misc'

export function InboxPage() {
  const tasks = useData((s) => s.tasks)
  const items = useMemo(() => inboxTasks(tasks), [tasks])

  return (
    <Page
      title="Inbox"
      subtitle={
        items.length
          ? `${items.length} to sort`
          : 'Everything starts here, then gets a home.'
      }
    >
      <div className="space-y-4">
        <InlineCapture placeholder="Capture anything — a task, an idea, a reminder" />

        {items.length ? (
          <TaskList tasks={items} />
        ) : (
          <div className="card">
            <EmptyState
              icon="Inbox"
              title="Inbox zero"
              description="Nothing waiting. Capture a thought above and sort it later — the point is to get it out of your head."
            />
          </div>
        )}
      </div>
    </Page>
  )
}
