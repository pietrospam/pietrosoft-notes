import { PrismaClient, NoteType, TaskStatus, TaskPriority, TimesheetState } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Clean existing data
  await prisma.note.deleteMany()
  await prisma.project.deleteMany()
  await prisma.client.deleteMany()

  // Create clients
  const acme = await prisma.client.create({
    data: {
      id: 'client-acme',
      name: 'ACME Corporation',
      description: 'Main enterprise client',
      active: true,
    }
  })

  const techstart = await prisma.client.create({
    data: {
      id: 'client-techstart',
      name: 'TechStart Inc',
      description: 'Startup technology company',
      active: true,
    }
  })

  const globalbank = await prisma.client.create({
    data: {
      id: 'client-globalbank',
      name: 'Global Bank',
      description: 'Financial services client',
      active: true,
    }
  })

  console.log('Created 3 clients')

  // Create projects
  const acmeWeb = await prisma.project.create({
    data: {
      id: 'proj-acme-web',
      name: 'Website Redesign',
      description: 'Complete redesign of corporate website',
      clientId: acme.id,
    }
  })

  const acmeApi = await prisma.project.create({
    data: {
      id: 'proj-acme-api',
      name: 'API Integration',
      description: 'REST API for mobile apps',
      clientId: acme.id,
    }
  })

  const techstartMvp = await prisma.project.create({
    data: {
      id: 'proj-techstart-mvp',
      name: 'MVP Development',
      description: 'Minimum viable product for launch',
      clientId: techstart.id,
    }
  })

  const bankPortal = await prisma.project.create({
    data: {
      id: 'proj-bank-portal',
      name: 'Customer Portal',
      description: 'Online banking portal redesign',
      clientId: globalbank.id,
    }
  })

  console.log('Created 4 projects')

  // Create notes - General
  await prisma.note.create({
    data: {
      id: 'note-general-1',
      type: NoteType.GENERAL,
      title: 'Meeting Notes - Kickoff',
      content: '<p>Discussed project timeline and deliverables.</p><ul><li>Phase 1: Design mockups</li><li>Phase 2: Frontend development</li><li>Phase 3: Backend integration</li></ul><p>Next meeting scheduled for next Monday.</p>',
      projectId: acmeWeb.id,
      clientId: acme.id,
    }
  })

  await prisma.note.create({
    data: {
      id: 'note-general-2',
      type: NoteType.GENERAL,
      title: 'Technical Requirements',
      content: '<p>Stack decided:</p><ul><li>Next.js 14 with App Router</li><li>PostgreSQL database</li><li>Tailwind CSS for styling</li><li>Deploy on Docker</li></ul>',
      projectId: techstartMvp.id,
      clientId: techstart.id,
    }
  })

  // Create notes - Tasks
  const task1 = await prisma.note.create({
    data: {
      id: 'note-task-1',
      type: NoteType.TASK,
      title: 'Setup development environment',
      content: '<p>Configure local dev environment with Docker and PostgreSQL.</p>',
      projectId: acmeWeb.id,
      clientId: acme.id,
      taskStatus: TaskStatus.COMPLETED,
      taskPriority: TaskPriority.HIGH,
      taskDueDate: new Date('2026-02-15'),
    }
  })

  const task2 = await prisma.note.create({
    data: {
      id: 'note-task-2',
      type: NoteType.TASK,
      title: 'Design homepage mockup',
      content: '<p>Create Figma mockup for the new homepage design.</p><p>Include:</p><ul><li>Hero section</li><li>Features grid</li><li>Testimonials</li><li>Footer</li></ul>',
      projectId: acmeWeb.id,
      clientId: acme.id,
      taskStatus: TaskStatus.IN_PROGRESS,
      taskPriority: TaskPriority.HIGH,
      taskDueDate: new Date('2026-02-25'),
    }
  })

  const task3 = await prisma.note.create({
    data: {
      id: 'note-task-3',
      type: NoteType.TASK,
      title: 'Implement authentication',
      content: '<p>Add JWT-based authentication with refresh tokens.</p>',
      projectId: acmeApi.id,
      clientId: acme.id,
      taskStatus: TaskStatus.PENDING,
      taskPriority: TaskPriority.CRITICAL,
      taskDueDate: new Date('2026-03-01'),
    }
  })

  await prisma.note.create({
    data: {
      id: 'note-task-4',
      type: NoteType.TASK,
      title: 'Database schema design',
      content: '<p>Design and implement the database schema for MVP.</p>',
      projectId: techstartMvp.id,
      clientId: techstart.id,
      taskStatus: TaskStatus.COMPLETED,
      taskPriority: TaskPriority.HIGH,
      taskDueDate: new Date('2026-02-10'),
    }
  })

  await prisma.note.create({
    data: {
      id: 'note-task-5',
      type: NoteType.TASK,
      title: 'Security audit preparation',
      content: '<p>Prepare documentation for security audit.</p>',
      projectId: bankPortal.id,
      clientId: globalbank.id,
      taskStatus: TaskStatus.PENDING,
      taskPriority: TaskPriority.CRITICAL,
      taskDueDate: new Date('2026-03-15'),
    }
  })

  console.log('Created 5 tasks')

  // Create notes - Connections
  await prisma.note.create({
    data: {
      id: 'note-conn-1',
      type: NoteType.CONNECTION,
      title: 'ACME Production Server',
      content: '<p>SSH access to production server</p>',
      projectId: acmeWeb.id,
      clientId: acme.id,
      connectionUrl: 'ssh://deploy@acme-prod.example.com',
      connectionCredentials: 'User: deploy\nKey: ~/.ssh/acme_prod_key',
    }
  })

  await prisma.note.create({
    data: {
      id: 'note-conn-2',
      type: NoteType.CONNECTION,
      title: 'ACME Staging Database',
      content: '<p>PostgreSQL staging database</p>',
      projectId: acmeApi.id,
      clientId: acme.id,
      connectionUrl: 'postgresql://staging.acme-db.example.com:5432/acme_staging',
      connectionCredentials: 'User: acme_staging\nPassword: staging_pass_2026',
    }
  })

  await prisma.note.create({
    data: {
      id: 'note-conn-3',
      type: NoteType.CONNECTION,
      title: 'TechStart AWS Console',
      content: '<p>AWS management console access</p>',
      projectId: techstartMvp.id,
      clientId: techstart.id,
      connectionUrl: 'https://techstart.signin.aws.amazon.com/console',
      connectionCredentials: 'User: dev@techstart.io\nPassword: Aws#Dev2026!',
    }
  })

  console.log('Created 3 connections')

  // Create notes - Timesheets
  await prisma.note.create({
    data: {
      id: 'note-ts-1',
      type: NoteType.TIMESHEET,
      title: 'Dev environment setup',
      content: '<p>Initial setup and configuration</p>',
      projectId: acmeWeb.id,
      clientId: acme.id,
      timesheetDate: new Date('2026-02-15'),
      timesheetHours: 4,
      timesheetRate: 75,
      timesheetState: TimesheetState.FINAL,
      timesheetTaskId: task1.id,
    }
  })

  await prisma.note.create({
    data: {
      id: 'note-ts-2',
      type: NoteType.TIMESHEET,
      title: 'Homepage design work',
      content: '<p>Worked on hero section and feature grid</p>',
      projectId: acmeWeb.id,
      clientId: acme.id,
      timesheetDate: new Date('2026-02-18'),
      timesheetHours: 6,
      timesheetRate: 75,
      timesheetState: TimesheetState.DRAFT,
      timesheetTaskId: task2.id,
    }
  })

  await prisma.note.create({
    data: {
      id: 'note-ts-3',
      type: NoteType.TIMESHEET,
      title: 'Homepage design continued',
      content: '<p>Testimonials and footer sections</p>',
      projectId: acmeWeb.id,
      clientId: acme.id,
      timesheetDate: new Date('2026-02-19'),
      timesheetHours: 5,
      timesheetRate: 75,
      timesheetState: TimesheetState.DRAFT,
      timesheetTaskId: task2.id,
    }
  })

  await prisma.note.create({
    data: {
      id: 'note-ts-4',
      type: NoteType.TIMESHEET,
      title: 'API planning session',
      content: '<p>Architecture review and planning</p>',
      projectId: acmeApi.id,
      clientId: acme.id,
      timesheetDate: new Date('2026-02-17'),
      timesheetHours: 3,
      timesheetRate: 85,
      timesheetState: TimesheetState.FINAL,
      timesheetTaskId: task3.id,
    }
  })

  console.log('Created 4 timesheets')

  console.log('Seed completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
