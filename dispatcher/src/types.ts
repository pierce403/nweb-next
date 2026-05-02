export type ScanProfile = 'quick' | 'top-1000' | 'full' | string

export interface WorkPolicy {
  rateLimit?: string
  respectOptOut?: boolean
  notes?: string
}

export interface WorkItem {
  id: string
  description?: string
  targets: string[]
  profile: ScanProfile
  withAssets: boolean
  priority: number
  policy?: WorkPolicy
  labels?: string[]
}

export interface WorkFile {
  version: number
  dispatcher: string
  updatedAt: string
  work: WorkItem[]
}

export interface GetWorkResponse {
  version: number
  dispatcher: string
  generatedAt: string
  count: number
  work: WorkItem[]
}

export interface TargetRequest {
  id: string
  domain: string
  profile: ScanProfile
  priority: number
  withAssets: boolean
  notes?: string
  source: 'analyst'
  createdAt: string
}

export interface TargetQueueFile {
  version: number
  updatedAt: string
  targets: TargetRequest[]
}
