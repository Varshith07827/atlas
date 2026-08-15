import { addDays, toDateOnly } from '@/lib/date'
import { nowISO, uid } from '@/lib/utils'
import type { Snapshot, Task } from '@/types'
import type { AuthUser } from './backend'

/**
 * First-run content.
 *
 * An empty productivity app is a hard thing to evaluate — you can't tell a
 * clean design from an unfinished one until there's something in it. This seeds
 * enough to make every screen legible, and it's all deletable.
 */
export function buildSeed(user: AuthUser, workspaceId: string): Snapshot {
  const now = nowISO()
  const me = user.id

  const project = (name: string, color: string, icon: string, position: number) => ({
    id: uid(),
    workspace_id: workspaceId,
    name,
    description: null,
    color,
    icon,
    archived: false,
    is_private: false,
    position,
    created_by: me,
    created_at: now,
    updated_at: now,
  })

  const college = project('College', 'oklch(65% 0.16 258)', 'GraduationCap', 1000)
  const personal = project('Personal', 'oklch(68% 0.15 150)', 'House', 2000)
  const fitness = project('Fitness', 'oklch(70% 0.17 40)', 'Dumbbell', 3000)

  const label = (name: string, color: string) => ({
    id: uid(),
    workspace_id: workspaceId,
    name,
    color,
    created_at: now,
  })

  const deepWork = label('deep work', 'oklch(65% 0.15 290)')
  const quick = label('quick', 'oklch(70% 0.13 190)')
  const errand = label('errand', 'oklch(72% 0.14 90)')

  let seq = 0
  const task = (t: Partial<Task> & { title: string }): Task => ({
    id: uid(),
    workspace_id: workspaceId,
    project_id: null,
    description: null,
    status: 'inbox',
    priority: 4,
    due_date: null,
    scheduled_start: null,
    scheduled_end: null,
    estimate_minutes: null,
    subtasks: [],
    position: (seq += 1000),
    completed_at: null,
    is_private: false,
    created_by: me,
    created_at: now,
    updated_at: now,
    ...t,
  })

  const dayAt = (offset: number, hour: number, minutes = 0) => {
    const d = addDays(new Date(), offset)
    d.setHours(hour, minutes, 0, 0)
    return d.toISOString()
  }

  const focusBlock = task({
    title: 'Data structures problem set',
    description:
      'Trees and graph traversal. Chapter 6 exercises 1–14.\n\nThe last four are the ones that matter.',
    project_id: college.id,
    status: 'today',
    priority: 1,
    due_date: toDateOnly(addDays(new Date(), 1)),
    estimate_minutes: 90,
    scheduled_start: dayAt(0, 16),
    scheduled_end: dayAt(0, 17, 30),
    subtasks: [
      { id: uid(), title: 'Re-read the lecture notes', done: true },
      { id: uid(), title: 'Exercises 1–8', done: false },
      { id: uid(), title: 'Exercises 9–14', done: false },
    ],
  })

  const tasks: Task[] = [
    focusBlock,
    task({
      title: 'Book the dentist',
      status: 'today',
      priority: 2,
      project_id: personal.id,
      due_date: toDateOnly(),
      estimate_minutes: 10,
    }),
    task({
      title: 'Draft the hackathon pitch',
      description: 'Two minutes, one slide, no jargon.',
      status: 'doing',
      priority: 1,
      project_id: college.id,
      due_date: toDateOnly(addDays(new Date(), 3)),
      estimate_minutes: 45,
    }),
    task({
      title: 'Upper body — push day',
      status: 'today',
      priority: 3,
      project_id: fitness.id,
      estimate_minutes: 50,
      scheduled_start: dayAt(0, 19),
      scheduled_end: dayAt(0, 19, 50),
    }),
    task({
      title: 'Read one chapter of the systems book',
      status: 'inbox',
      priority: 3,
      project_id: personal.id,
      estimate_minutes: 30,
    }),
    task({
      title: 'Renew the library card',
      status: 'inbox',
      priority: 4,
      project_id: personal.id,
    }),
    task({
      title: 'Idea: weekly review ritual on Sunday evenings',
      description:
        'Fifteen minutes. Clear the inbox, look at next week, pick the one thing that matters.',
      status: 'inbox',
      priority: 4,
    }),
    task({
      title: 'Submit the scholarship form',
      status: 'inbox',
      priority: 1,
      project_id: college.id,
      due_date: toDateOnly(addDays(new Date(), 5)),
    }),
    task({
      title: 'Set up the new laptop',
      status: 'done',
      priority: 3,
      project_id: personal.id,
      completed_at: now,
    }),
    task({
      title: 'Cancel the unused subscription',
      status: 'done',
      priority: 4,
      project_id: personal.id,
      completed_at: now,
    }),
  ]

  const habit = (
    name: string,
    icon: string,
    color: string,
    target: number,
    unit: string | null,
    position: number,
  ) => ({
    id: uid(),
    workspace_id: workspaceId,
    name,
    icon,
    color,
    target_per_day: target,
    unit,
    archived: false,
    position,
    created_by: me,
    created_at: now,
  })

  const habits = [
    habit('Study', 'BookOpen', 'oklch(65% 0.16 258)', 1, null, 1000),
    habit('Workout', 'Dumbbell', 'oklch(70% 0.17 40)', 1, null, 2000),
    habit('Reading', 'Book', 'oklch(68% 0.14 300)', 1, null, 3000),
    habit('Meditation', 'Sparkles', 'oklch(70% 0.12 200)', 1, null, 4000),
    habit('Water', 'Droplet', 'oklch(70% 0.13 220)', 8, 'glasses', 5000),
  ]

  // A plausible-looking history so the streak rings aren't all empty.
  const habit_logs = habits.flatMap((h, hi) =>
    [1, 2, 3, 4, 5]
      .filter((d) => (d + hi) % 3 !== 0)
      .map((d) => ({
        id: uid(),
        habit_id: h.id,
        user_id: me,
        date: toDateOnly(addDays(new Date(), -d)),
        count: h.target_per_day,
      })),
  )

  const firstName = (user.display_name ?? user.email.split('@')[0] ?? '').split(' ')[0]
  const workspace = {
    id: workspaceId,
    // Named after its owner: once you can be in two workspaces, "My workspace"
    // twice over in the switcher is useless.
    name: firstName ? `${firstName}'s workspace` : 'My workspace',
    owner_id: me,
    created_at: now,
  }

  return {
    workspace,
    workspaces: [workspace],
    members: [
      {
        workspace_id: workspaceId,
        user_id: me,
        role: 'owner',
        created_at: now,
        profile: {
          id: me,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          created_at: now,
        },
      },
    ],
    projects: [college, personal, fitness],
    tasks,
    labels: [deepWork, quick, errand],
    task_labels: [
      { task_id: focusBlock.id, label_id: deepWork.id },
      { task_id: tasks[1].id, label_id: quick.id },
      { task_id: tasks[5].id, label_id: errand.id },
    ],
    notes: [
      {
        id: uid(),
        workspace_id: workspaceId,
        project_id: college.id,
        title: 'Hackathon notes',
        content:
          '# Hackathon\n\nTheme is **local-first tools**. Judging is Sunday at 4pm.\n\n## The pitch\n\n1. One sentence on the problem\n2. Show the thing working\n3. Stop talking\n\n## To bring\n\n- [x] Laptop + charger\n- [ ] HDMI adapter\n- [ ] Snacks that are not crisps\n\n> Nobody has ever complained that a demo was too short.\n',
        pinned: true,
        is_private: false,
        created_by: me,
        created_at: now,
        updated_at: now,
      },
      {
        id: uid(),
        workspace_id: workspaceId,
        project_id: null,
        title: 'Reading list',
        content:
          '- *The Design of Everyday Things* — started\n- *Thinking in Systems*\n- *A Pattern Language* — borrow, do not buy\n',
        pinned: false,
        is_private: false,
        created_by: me,
        created_at: now,
        updated_at: now,
      },
    ],
    events: [
      {
        id: uid(),
        workspace_id: workspaceId,
        project_id: college.id,
        task_id: focusBlock.id,
        title: 'Data structures problem set',
        description: null,
        start_at: focusBlock.scheduled_start!,
        end_at: focusBlock.scheduled_end!,
        all_day: false,
        color: college.color,
        location: null,
        is_private: false,
        created_by: me,
        created_at: now,
        updated_at: now,
      },
      {
        id: uid(),
        workspace_id: workspaceId,
        project_id: college.id,
        task_id: null,
        title: 'Algorithms lecture',
        description: null,
        start_at: dayAt(1, 10),
        end_at: dayAt(1, 11, 30),
        all_day: false,
        color: college.color,
        location: 'Hall B',
        is_private: false,
        created_by: me,
        created_at: now,
        updated_at: now,
      },
      {
        id: uid(),
        workspace_id: workspaceId,
        project_id: personal.id,
        task_id: null,
        title: 'Coffee with Sam',
        description: null,
        start_at: dayAt(2, 15),
        end_at: dayAt(2, 16),
        all_day: false,
        color: personal.color,
        location: null,
        is_private: false,
        created_by: me,
        created_at: now,
        updated_at: now,
      },
    ],
    habits,
    habit_logs,
    comments: [],
    notifications: [],
    settings: defaultSettings(me),
  }
}

export function defaultSettings(userId: string) {
  return {
    user_id: userId,
    theme: 'dark' as const,
    accent: 'oklch(70% 0.16 258)',
    week_start: 1 as const,
    notifications_enabled: false,
    notify_due_today: true,
    notify_deadlines: true,
    reminder_lead_minutes: 10,
    default_calendar_view: 'timeGridWeek' as const,
    updated_at: nowISO(),
  }
}

/** An empty workspace, for cloud users who'd rather start from nothing. */
export function buildEmpty(user: AuthUser, workspaceId: string): Snapshot {
  const seed = buildSeed(user, workspaceId)
  return {
    ...seed,
    projects: [],
    tasks: [],
    labels: [],
    task_labels: [],
    notes: [],
    events: [],
    habits: [],
    habit_logs: [],
  }
}
