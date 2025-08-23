export interface Database {
  submissions: Submission
  records: Record
  indexer_state: IndexerState
}

export interface Submission {
  uid: string
  submitter: string
  job_id: string
  namespace: string
  dataset_type: string
  cid: string
  merkle_root: string
  target_spec_cid: string
  started_at: number
  finished_at: number
  tool: string
  version: string
  vantage: string
  manifest_sha256: string
  extra: Buffer
  timestamp: number
  processed_at: Date | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message: string | null
  created_at: Date
}

export interface Record {
  id: number
  submission_uid: string
  timestamp: number
  ip: string
  port: number
  protocol: string
  state: string
  service: string | null
  product: string | null
  version: string | null
  banner_sha256: string | null
  cert_fpr: string | null
  tls_ja3: string | null
  latency_ms: number | null
  tool: string
  tool_version: string
  options: string
  vantage: string
}

export interface IndexerState {
  id: number
  last_block: number
  last_attestation_uid: string
  processed_count: number
  error_count: number
  updated_at: Date
}

// Extended types for API responses
export interface SubmissionWithStats extends Submission {
  record_count: number
  unique_ips: number
  unique_ports: number
}

export interface RecordWithSubmission extends Record {
  submission: Submission
}

export interface DashboardStats {
  total_submissions: number
  total_records: number
  unique_ips: number
  unique_services: number
  submissions_by_status: {
    pending: number
    processing: number
    completed: number
    failed: number
  }
  recent_activity: Array<{
    date: string
    submissions: number
    records: number
  }>
  top_services: Array<{
    service: string
    count: number
  }>
  top_ips: Array<{
    ip: string
    count: number
  }>
}
