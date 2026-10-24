// Generated from docs/api/treehole-openapi-v1.json. DO NOT EDIT.
// Run: pnpm treehole:generate. Limits and conditional constraints require runtime validation.
export type TreeholeContractVersion = "1.0.0"

export type Id = (string)

export type Time = (string)

export type Pagination = ({ "page": (number); "pageSize": (10); "total": (number); "totalPages": (number) })

export type SubmissionStatus = ("pending_review" | "published" | "rejected" | "closed" | "unavailable")

export type ReasonCode = ((("content_violation" | "review_timeout" | "content_unavailable") | (null)))

export type Receipt = ({ "id": Id; "status": SubmissionStatus; "submittedAt": Time; "publishedAt": ((Time | (null))); "expiresAt": ((Time | (null))); "reasonCode": ReasonCode })

export type AnonymousAuthor = ({ "nickname": (string); "isOp": (boolean); "isMe": (boolean) })

export type Post = ({ "id": Id; "content": (string); "author": AnonymousAuthor; "status": ("published"); "publishedAt": Time; "expiresAt": Time; "likeCount": (number); "commentCount": (number); "likedByMe": (boolean); "canDelete": (boolean) }) & (({ "author"?: ({ "isOp"?: (true) }) }))

export type PublishedComment = ({ "id": Id; "replyToCommentId": ((Id | (null))); "publishedAt": Time; "content": (string); "author": AnonymousAuthor; "status": ("published"); "canDelete": (boolean) })

export type DeletedComment = ({ "id": Id; "replyToCommentId": ((Id | (null))); "publishedAt": Time; "content": (null); "author": (null); "status": ("deleted"); "canDelete": (false) })

export type Comment = ((PublishedComment | DeletedComment))

export type MyPost = ({ "id": Id; "status": ("pending_review" | "published" | "rejected" | "closed"); "submittedAt": Time; "publishedAt": ((Time | (null))); "expiresAt": ((Time | (null))); "reasonCode": ReasonCode; "content": (((string) | (null))); "ttlHours": (1 | 6 | 12 | 24); "canDelete": (boolean) })

export type MyComment = ({ "id": Id; "status": ("pending_review" | "published" | "rejected" | "closed"); "submittedAt": Time; "publishedAt": ((Time | (null))); "expiresAt": ((Time | (null))); "reasonCode": ReasonCode; "postId": Id; "replyToCommentId": ((Id | (null))); "content": (((string) | (null))); "canDelete": (boolean) })

export type CreatePost = ({ "content": (string); "ttlHours"?: (1 | 6 | 12 | 24) })

export type CreateComment = ({ "content": (string); "replyToCommentId"?: Id })

export type LikeResult = ({ "liked": (boolean); "likeCount": (number) })

export type ReportReason = ("insult" | "harassment" | "privacy" | "threat" | "disputed_accusation" | "other")

export type CreateReport = ({ "reason": ReportReason; "description"?: (string) })

export type ReportStatus = ("pending" | "upheld" | "dismissed")

export type ReportReceipt = ({ "id": Id; "status": ReportStatus; "createdAt": Time })

export type Restriction = ({ "penaltyId": Id; "type": ("temporary" | "permanent"); "reason": (string); "restrictedCapabilities": (Array<("treehole_access")>); "endsAt": ((Time | (null))); "appealDeadlineAt": Time; "canAppeal": (boolean) })

export type Access = ((({ "canEnter": (true); "restriction": (null) }) | ({ "canEnter": (false); "restriction": Restriction })))

export type PenaltyStatus = ("pending_confirmation" | "active" | "ended" | "revoked" | "superseded" | "declined")

export type PenaltyType = ("warning" | "temporary" | "permanent")

export type Penalty = ({ "id": Id; "type": PenaltyType; "status": ("active" | "ended" | "revoked" | "superseded"); "reason": (string); "restrictedCapabilities": (Array<("treehole_access")>); "startsAt": Time; "endsAt": ((Time | (null))); "notifiedAt": Time; "appealDeadlineAt": Time; "canAppeal": (boolean) })

export type Evidence = ({ "content": (((string) | (null))); "quotes": (Array<(string)>); "explanation": (string) })

export type PenaltyDetail = ({ "id": Id; "type": PenaltyType; "status": ("active" | "ended" | "revoked" | "superseded"); "reason": (string); "restrictedCapabilities": (Array<("treehole_access")>); "startsAt": Time; "endsAt": ((Time | (null))); "notifiedAt": Time; "appealDeadlineAt": Time; "canAppeal": (boolean); "evidence": (Array<Evidence>) })

export type AppealStatus = ("pending" | "upheld" | "rejected")

export type CreateAppeal = ({ "reason": (string) })

export type Appeal = ({ "id": Id; "penaltyId": Id; "status": AppealStatus; "reason": (string); "createdAt": Time; "decisionReason": (((string) | (null))); "resolvedAt": ((Time | (null))); "overdue": (boolean) })

export type ReviewStatus = ("queued" | "processing" | "completed" | "cancelled")

export type ReviewerType = ("rule" | "ai" | "human")

export type ViolationCode = ("minor_insult" | "direct_insult" | "harassment" | "privacy_leak" | "threat" | "substantiated_defamation")

export type Target = ({ "type": ("post" | "comment"); "id": Id; "postId": Id; "availability": ("published" | "pending_review" | "unavailable") })

export type AdminReview = ({ "id": Id; "target": Target; "source": ("submission" | "sample" | "report" | "appeal" | "manual"); "reviewerType": ReviewerType; "status": ReviewStatus; "decision": ((("approve" | "violation" | "needs_human") | (null))); "violationCode": ((ViolationCode | (null))); "points": (((number) | (null))); "reason": (((string) | (null))); "targetReviewVersion": (number); "isCurrent": (boolean); "previousReviewId": ((Id | (null))); "countedViolationId": ((Id | (null))); "createdAt": Time; "completedAt": ((Time | (null))) })

export type ContextItem = ({ "target": Target; "content": (((string) | (null))) })

export type AdminReviewDetail = ({ "id": Id; "target": Target; "source": ("submission" | "sample" | "report" | "appeal" | "manual"); "reviewerType": ReviewerType; "status": ReviewStatus; "decision": ((("approve" | "violation" | "needs_human") | (null))); "violationCode": ((ViolationCode | (null))); "points": (((number) | (null))); "reason": (((string) | (null))); "targetReviewVersion": (number); "isCurrent": (boolean); "previousReviewId": ((Id | (null))); "countedViolationId": ((Id | (null))); "createdAt": Time; "completedAt": ((Time | (null))); "content": (((string) | (null))); "context": (Array<ContextItem>); "evidenceQuotes": (Array<(string)>); "ruleVersion": (string); "history": (Array<AdminReview>) })

export type ReviewDecision = ((({ "decision": ("approve"); "reason": (string) }) | ({ "decision": ("violation"); "violationCode": ("minor_insult"); "points": (number); "reason": (string) }) | ({ "decision": ("violation"); "violationCode": ("direct_insult"); "points": (number); "reason": (string) }) | ({ "decision": ("violation"); "violationCode": ("harassment"); "points": (number); "reason": (string) }) | ({ "decision": ("violation"); "violationCode": ("privacy_leak"); "points": (number); "reason": (string) }) | ({ "decision": ("violation"); "violationCode": ("threat"); "points": (number); "reason": (string) }) | ({ "decision": ("violation"); "violationCode": ("substantiated_defamation"); "points": (number); "reason": (string) })))

export type ReviewDecisionResult = ({ "id": Id; "status": ("completed"); "decision": ("approve" | "violation"); "violationId": ((Id | (null))); "penaltyIds": (Array<Id>); "decidedAt": Time })

export type AdminReport = ({ "id": Id; "target": Target; "reason": ReportReason; "description": (((string) | (null))); "status": ReportStatus; "reviewId": ((Id | (null))); "createdAt": Time; "resolvedAt": ((Time | (null))) })

export type AdminReportDetail = ({ "id": Id; "target": Target; "reason": ReportReason; "description": (((string) | (null))); "status": ReportStatus; "reviewId": ((Id | (null))); "createdAt": Time; "resolvedAt": ((Time | (null))); "decisionReason": (((string) | (null))); "review": ((AdminReviewDetail | (null))) })

export type ReportDecision = ({ "decision": ("upheld" | "dismissed"); "reviewId": Id; "reason": (string) })

export type ReportDecisionResult = ({ "id": Id; "status": ("upheld" | "dismissed"); "reviewId": Id; "decidedAt": Time })

export type AdminPenalty = ({ "id": Id; "type": PenaltyType; "status": PenaltyStatus; "tier": (number); "basis": ("accumulated_score" | "manual_severity" | "provisional"); "scoreSnapshot": (number); "ruleVersion": (string); "reviewId": ((Id | (null))); "triggerViolationId": ((Id | (null))); "supersedesPenaltyId": ((Id | (null))); "reason": (string); "startsAt": ((Time | (null))); "endsAt": ((Time | (null))); "notifiedAt": ((Time | (null))); "createdAt": Time; "revokedAt": ((Time | (null))); "revokeReason": (((string) | (null))) })

export type AdminPenaltyDetail = ({ "id": Id; "type": PenaltyType; "status": PenaltyStatus; "tier": (number); "basis": ("accumulated_score" | "manual_severity" | "provisional"); "scoreSnapshot": (number); "ruleVersion": (string); "reviewId": ((Id | (null))); "triggerViolationId": ((Id | (null))); "supersedesPenaltyId": ((Id | (null))); "reason": (string); "startsAt": ((Time | (null))); "endsAt": ((Time | (null))); "notifiedAt": ((Time | (null))); "createdAt": Time; "revokedAt": ((Time | (null))); "revokeReason": (((string) | (null))); "evidence": (Array<Evidence>); "relatedReviewIds": (Array<Id>); "relatedAppealIds": (Array<Id>) })

export type PenaltyDecision = ((({ "decision": ("confirm"); "tier": (number); "reason": (string) }) | ({ "decision": ("decline"); "reason": (string) })))

export type PenaltyDecisionResult = ({ "id": Id; "status": ("active" | "declined"); "tier": (number); "startsAt": ((Time | (null))); "endsAt": ((Time | (null))); "decidedAt": Time })

export type RevokePenalty = ({ "reason": (string) })

export type RevokePenaltyResult = ({ "id": Id; "status": ("revoked"); "decidedAt": Time; "recomputed": (true) })

export type AdminAppeal = ({ "id": Id; "penaltyId": Id; "status": AppealStatus; "reason": (string); "createdAt": Time; "decisionReason": (((string) | (null))); "resolvedAt": ((Time | (null))); "overdue": (boolean) })

export type AdminAppealDetail = ({ "id": Id; "penaltyId": Id; "status": AppealStatus; "reason": (string); "createdAt": Time; "decisionReason": (((string) | (null))); "resolvedAt": ((Time | (null))); "overdue": (boolean); "penalty": AdminPenaltyDetail })

export type AppealDecision = ({ "decision": ("uphold" | "reject"); "reason": (string) })

export type AppealDecisionResult = ((({ "id": Id; "penaltyId": Id; "status": ("upheld"); "decidedAt": Time; "recomputed": (true) }) | ({ "id": Id; "penaltyId": Id; "status": ("rejected"); "decidedAt": Time; "recomputed": (false) })))

export type ValidationDetails = ({ "fields": (Array<({ "path": (string); "issue": ("required" | "invalid_type" | "invalid_format" | "out_of_range" | "unknown_field") })>) })

export type RetryDetails = ({ "retryAt": Time })

export type RuleDetails = ({ "reasonCode": ("content_requires_change") })

export type Error = ({ "error": ({ "code": ("VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" | "TREEHOLE_RESTRICTED" | "TREEHOLE_POST_NOT_FOUND" | "TREEHOLE_COMMENT_NOT_FOUND" | "TREEHOLE_CASE_NOT_FOUND" | "IDEMPOTENCY_CONFLICT" | "TREEHOLE_CASE_ALREADY_RESOLVED" | "TREEHOLE_CASE_NOT_ACTIONABLE" | "TREEHOLE_APPEAL_PENDING" | "TREEHOLE_APPEAL_WINDOW_CLOSED" | "TREEHOLE_APPEAL_NOT_ALLOWED" | "TREEHOLE_CONTENT_REJECTED" | "TREEHOLE_DAILY_LIMIT_REACHED" | "TREEHOLE_SUBMIT_TOO_FAST" | "INTERNAL_ERROR" | "MINIAPP_AUTH_NOT_CONFIGURED"); "message": (string); "details"?: ((Restriction | RetryDetails | ValidationDetails | RuleDetails)); "requestId": (string) }) })

export type PostPage = ({ "items": (Array<Post>); "pagination": Pagination })

export type CommentPage = ({ "items": (Array<Comment>); "pagination": Pagination })

export type MyPostPage = ({ "items": (Array<MyPost>); "pagination": Pagination })

export type MyCommentPage = ({ "items": (Array<MyComment>); "pagination": Pagination })

export type PenaltyPage = ({ "items": (Array<Penalty>); "pagination": Pagination })

export type AppealPage = ({ "items": (Array<Appeal>); "pagination": Pagination })

export type AdminReviewPage = ({ "items": (Array<AdminReview>); "pagination": Pagination })

export type AdminReportPage = ({ "items": (Array<AdminReport>); "pagination": Pagination })

export type AdminPenaltyPage = ({ "items": (Array<AdminPenalty>); "pagination": Pagination })

export type AdminAppealPage = ({ "items": (Array<AdminAppeal>); "pagination": Pagination })

export interface TreeholeSchemas {
  Id: Id
  Time: Time
  Pagination: Pagination
  SubmissionStatus: SubmissionStatus
  ReasonCode: ReasonCode
  Receipt: Receipt
  AnonymousAuthor: AnonymousAuthor
  Post: Post
  PublishedComment: PublishedComment
  DeletedComment: DeletedComment
  Comment: Comment
  MyPost: MyPost
  MyComment: MyComment
  CreatePost: CreatePost
  CreateComment: CreateComment
  LikeResult: LikeResult
  ReportReason: ReportReason
  CreateReport: CreateReport
  ReportStatus: ReportStatus
  ReportReceipt: ReportReceipt
  Restriction: Restriction
  Access: Access
  PenaltyStatus: PenaltyStatus
  PenaltyType: PenaltyType
  Penalty: Penalty
  Evidence: Evidence
  PenaltyDetail: PenaltyDetail
  AppealStatus: AppealStatus
  CreateAppeal: CreateAppeal
  Appeal: Appeal
  ReviewStatus: ReviewStatus
  ReviewerType: ReviewerType
  ViolationCode: ViolationCode
  Target: Target
  AdminReview: AdminReview
  ContextItem: ContextItem
  AdminReviewDetail: AdminReviewDetail
  ReviewDecision: ReviewDecision
  ReviewDecisionResult: ReviewDecisionResult
  AdminReport: AdminReport
  AdminReportDetail: AdminReportDetail
  ReportDecision: ReportDecision
  ReportDecisionResult: ReportDecisionResult
  AdminPenalty: AdminPenalty
  AdminPenaltyDetail: AdminPenaltyDetail
  PenaltyDecision: PenaltyDecision
  PenaltyDecisionResult: PenaltyDecisionResult
  RevokePenalty: RevokePenalty
  RevokePenaltyResult: RevokePenaltyResult
  AdminAppeal: AdminAppeal
  AdminAppealDetail: AdminAppealDetail
  AppealDecision: AppealDecision
  AppealDecisionResult: AppealDecisionResult
  ValidationDetails: ValidationDetails
  RetryDetails: RetryDetails
  RuleDetails: RuleDetails
  Error: Error
  PostPage: PostPage
  CommentPage: CommentPage
  MyPostPage: MyPostPage
  MyCommentPage: MyCommentPage
  PenaltyPage: PenaltyPage
  AppealPage: AppealPage
  AdminReviewPage: AdminReviewPage
  AdminReportPage: AdminReportPage
  AdminPenaltyPage: AdminPenaltyPage
  AdminAppealPage: AdminAppealPage
}

export interface TreeholeOperations {
  listTreeholePosts: {
    method: "GET"
    path: "/api/miniapp/treehole/posts"
    request: { query?: { "page"?: (number); "pageSize"?: (10) } }
    responses: {
      200: PostPage
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_RESTRICTED") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
      503: (Error) & (({ "error"?: ({ "code"?: ("MINIAPP_AUTH_NOT_CONFIGURED") }) }))
    }
  }
  createTreeholePost: {
    method: "POST"
    path: "/api/miniapp/treehole/posts"
    request: { headers: { "Idempotency-Key": (string) }; body: CreatePost }
    responses: {
      201: Receipt
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_RESTRICTED") }) }))
      409: (Error) & (({ "error"?: ({ "code"?: ("IDEMPOTENCY_CONFLICT") }) }))
      422: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_CONTENT_REJECTED") }) }))
      429: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_DAILY_LIMIT_REACHED" | "TREEHOLE_SUBMIT_TOO_FAST") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
      503: (Error) & (({ "error"?: ({ "code"?: ("MINIAPP_AUTH_NOT_CONFIGURED") }) }))
    }
  }
  getTreeholePost: {
    method: "GET"
    path: "/api/miniapp/treehole/posts/{postId}"
    request: { pathParams: { "postId": Id } }
    responses: {
      200: Post
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_RESTRICTED") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_POST_NOT_FOUND") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
      503: (Error) & (({ "error"?: ({ "code"?: ("MINIAPP_AUTH_NOT_CONFIGURED") }) }))
    }
  }
  listTreeholeComments: {
    method: "GET"
    path: "/api/miniapp/treehole/posts/{postId}/comments"
    request: { pathParams: { "postId": Id }; query?: { "page"?: (number); "pageSize"?: (10) } }
    responses: {
      200: CommentPage
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_RESTRICTED") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_POST_NOT_FOUND") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
      503: (Error) & (({ "error"?: ({ "code"?: ("MINIAPP_AUTH_NOT_CONFIGURED") }) }))
    }
  }
  createTreeholeComment: {
    method: "POST"
    path: "/api/miniapp/treehole/posts/{postId}/comments"
    request: { pathParams: { "postId": Id }; headers: { "Idempotency-Key": (string) }; body: CreateComment }
    responses: {
      201: Receipt
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_RESTRICTED") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_POST_NOT_FOUND" | "TREEHOLE_COMMENT_NOT_FOUND") }) }))
      409: (Error) & (({ "error"?: ({ "code"?: ("IDEMPOTENCY_CONFLICT") }) }))
      422: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_CONTENT_REJECTED") }) }))
      429: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_DAILY_LIMIT_REACHED" | "TREEHOLE_SUBMIT_TOO_FAST") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
      503: (Error) & (({ "error"?: ({ "code"?: ("MINIAPP_AUTH_NOT_CONFIGURED") }) }))
    }
  }
  likeTreeholePost: {
    method: "PUT"
    path: "/api/miniapp/treehole/posts/{postId}/likes/me"
    request: { pathParams: { "postId": Id } }
    responses: {
      200: (LikeResult) & (({ "liked"?: (true) }))
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_RESTRICTED") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_POST_NOT_FOUND") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
      503: (Error) & (({ "error"?: ({ "code"?: ("MINIAPP_AUTH_NOT_CONFIGURED") }) }))
    }
  }
  unlikeTreeholePost: {
    method: "DELETE"
    path: "/api/miniapp/treehole/posts/{postId}/likes/me"
    request: { pathParams: { "postId": Id } }
    responses: {
      200: (LikeResult) & (({ "liked"?: (false) }))
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_RESTRICTED") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_POST_NOT_FOUND") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
      503: (Error) & (({ "error"?: ({ "code"?: ("MINIAPP_AUTH_NOT_CONFIGURED") }) }))
    }
  }
  reportTreeholePost: {
    method: "POST"
    path: "/api/miniapp/treehole/posts/{postId}/reports"
    request: { pathParams: { "postId": Id }; body: CreateReport }
    responses: {
      200: ReportReceipt
      201: ReportReceipt
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_RESTRICTED") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_POST_NOT_FOUND") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
      503: (Error) & (({ "error"?: ({ "code"?: ("MINIAPP_AUTH_NOT_CONFIGURED") }) }))
    }
  }
  reportTreeholeComment: {
    method: "POST"
    path: "/api/miniapp/treehole/comments/{commentId}/reports"
    request: { pathParams: { "commentId": Id }; body: CreateReport }
    responses: {
      200: ReportReceipt
      201: ReportReceipt
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_RESTRICTED") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_POST_NOT_FOUND" | "TREEHOLE_COMMENT_NOT_FOUND") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
      503: (Error) & (({ "error"?: ({ "code"?: ("MINIAPP_AUTH_NOT_CONFIGURED") }) }))
    }
  }
  getMyTreeholeAccess: {
    method: "GET"
    path: "/api/miniapp/me/treehole/access"
    request: Record<string, never>
    responses: {
      200: Access
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
      503: (Error) & (({ "error"?: ({ "code"?: ("MINIAPP_AUTH_NOT_CONFIGURED") }) }))
    }
  }
  listMyPosts: {
    method: "GET"
    path: "/api/miniapp/me/treehole/posts"
    request: { query?: { "page"?: (number); "pageSize"?: (10) } }
    responses: {
      200: MyPostPage
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
      503: (Error) & (({ "error"?: ({ "code"?: ("MINIAPP_AUTH_NOT_CONFIGURED") }) }))
    }
  }
  getMyPost: {
    method: "GET"
    path: "/api/miniapp/me/treehole/posts/{postId}"
    request: { pathParams: { "postId": Id } }
    responses: {
      200: MyPost
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_POST_NOT_FOUND") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
      503: (Error) & (({ "error"?: ({ "code"?: ("MINIAPP_AUTH_NOT_CONFIGURED") }) }))
    }
  }
  deleteMyPost: {
    method: "DELETE"
    path: "/api/miniapp/me/treehole/posts/{postId}"
    request: { pathParams: { "postId": Id } }
    responses: {
      204: undefined
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_POST_NOT_FOUND") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
      503: (Error) & (({ "error"?: ({ "code"?: ("MINIAPP_AUTH_NOT_CONFIGURED") }) }))
    }
  }
  listMyComments: {
    method: "GET"
    path: "/api/miniapp/me/treehole/comments"
    request: { query?: { "page"?: (number); "pageSize"?: (10) } }
    responses: {
      200: MyCommentPage
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
      503: (Error) & (({ "error"?: ({ "code"?: ("MINIAPP_AUTH_NOT_CONFIGURED") }) }))
    }
  }
  getMyComment: {
    method: "GET"
    path: "/api/miniapp/me/treehole/comments/{commentId}"
    request: { pathParams: { "commentId": Id } }
    responses: {
      200: MyComment
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_COMMENT_NOT_FOUND") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
      503: (Error) & (({ "error"?: ({ "code"?: ("MINIAPP_AUTH_NOT_CONFIGURED") }) }))
    }
  }
  deleteMyComment: {
    method: "DELETE"
    path: "/api/miniapp/me/treehole/comments/{commentId}"
    request: { pathParams: { "commentId": Id } }
    responses: {
      204: undefined
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_COMMENT_NOT_FOUND") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
      503: (Error) & (({ "error"?: ({ "code"?: ("MINIAPP_AUTH_NOT_CONFIGURED") }) }))
    }
  }
  listMyTreeholePenalties: {
    method: "GET"
    path: "/api/miniapp/me/treehole/penalties"
    request: { query?: { "page"?: (number); "pageSize"?: (10) } }
    responses: {
      200: PenaltyPage
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
      503: (Error) & (({ "error"?: ({ "code"?: ("MINIAPP_AUTH_NOT_CONFIGURED") }) }))
    }
  }
  getMyTreeholePenalty: {
    method: "GET"
    path: "/api/miniapp/me/treehole/penalties/{penaltyId}"
    request: { pathParams: { "penaltyId": Id } }
    responses: {
      200: PenaltyDetail
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_CASE_NOT_FOUND") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
      503: (Error) & (({ "error"?: ({ "code"?: ("MINIAPP_AUTH_NOT_CONFIGURED") }) }))
    }
  }
  createMyTreeholeAppeal: {
    method: "POST"
    path: "/api/miniapp/me/treehole/penalties/{penaltyId}/appeals"
    request: { pathParams: { "penaltyId": Id }; headers: { "Idempotency-Key": (string) }; body: CreateAppeal }
    responses: {
      201: Appeal
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_CASE_NOT_FOUND") }) }))
      409: (Error) & (({ "error"?: ({ "code"?: ("IDEMPOTENCY_CONFLICT" | "TREEHOLE_APPEAL_PENDING" | "TREEHOLE_APPEAL_WINDOW_CLOSED" | "TREEHOLE_APPEAL_NOT_ALLOWED") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
      503: (Error) & (({ "error"?: ({ "code"?: ("MINIAPP_AUTH_NOT_CONFIGURED") }) }))
    }
  }
  listMyTreeholeAppeals: {
    method: "GET"
    path: "/api/miniapp/me/treehole/appeals"
    request: { query?: { "page"?: (number); "pageSize"?: (10) } }
    responses: {
      200: AppealPage
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
      503: (Error) & (({ "error"?: ({ "code"?: ("MINIAPP_AUTH_NOT_CONFIGURED") }) }))
    }
  }
  listAdminReviews: {
    method: "GET"
    path: "/admin-api/treehole/reviews"
    request: { query?: { "page"?: (number); "pageSize"?: (10); "status"?: ReviewStatus; "reviewerType"?: ReviewerType } }
    responses: {
      200: AdminReviewPage
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("FORBIDDEN") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
    }
  }
  getAdminReview: {
    method: "GET"
    path: "/admin-api/treehole/reviews/{reviewId}"
    request: { pathParams: { "reviewId": Id } }
    responses: {
      200: AdminReviewDetail
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("FORBIDDEN") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_CASE_NOT_FOUND") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
    }
  }
  decideAdminReview: {
    method: "POST"
    path: "/admin-api/treehole/reviews/{reviewId}/decision"
    request: { pathParams: { "reviewId": Id }; headers: { "Idempotency-Key": (string) }; body: ReviewDecision }
    responses: {
      200: ReviewDecisionResult
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("FORBIDDEN") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_CASE_NOT_FOUND") }) }))
      409: (Error) & (({ "error"?: ({ "code"?: ("IDEMPOTENCY_CONFLICT" | "TREEHOLE_CASE_ALREADY_RESOLVED" | "TREEHOLE_CASE_NOT_ACTIONABLE") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
    }
  }
  listAdminReports: {
    method: "GET"
    path: "/admin-api/treehole/reports"
    request: { query?: { "page"?: (number); "pageSize"?: (10); "status"?: ReportStatus } }
    responses: {
      200: AdminReportPage
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("FORBIDDEN") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
    }
  }
  getAdminReport: {
    method: "GET"
    path: "/admin-api/treehole/reports/{reportId}"
    request: { pathParams: { "reportId": Id } }
    responses: {
      200: AdminReportDetail
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("FORBIDDEN") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_CASE_NOT_FOUND") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
    }
  }
  decideAdminReport: {
    method: "POST"
    path: "/admin-api/treehole/reports/{reportId}/decision"
    request: { pathParams: { "reportId": Id }; headers: { "Idempotency-Key": (string) }; body: ReportDecision }
    responses: {
      200: ReportDecisionResult
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("FORBIDDEN") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_CASE_NOT_FOUND") }) }))
      409: (Error) & (({ "error"?: ({ "code"?: ("IDEMPOTENCY_CONFLICT" | "TREEHOLE_CASE_ALREADY_RESOLVED" | "TREEHOLE_CASE_NOT_ACTIONABLE") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
    }
  }
  listAdminPenalties: {
    method: "GET"
    path: "/admin-api/treehole/penalties"
    request: { query?: { "page"?: (number); "pageSize"?: (10); "status"?: PenaltyStatus } }
    responses: {
      200: AdminPenaltyPage
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("FORBIDDEN") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
    }
  }
  getAdminPenalty: {
    method: "GET"
    path: "/admin-api/treehole/penalties/{penaltyId}"
    request: { pathParams: { "penaltyId": Id } }
    responses: {
      200: AdminPenaltyDetail
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("FORBIDDEN") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_CASE_NOT_FOUND") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
    }
  }
  decideAdminPenalty: {
    method: "POST"
    path: "/admin-api/treehole/penalties/{penaltyId}/decision"
    request: { pathParams: { "penaltyId": Id }; headers: { "Idempotency-Key": (string) }; body: PenaltyDecision }
    responses: {
      200: PenaltyDecisionResult
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("FORBIDDEN") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_CASE_NOT_FOUND") }) }))
      409: (Error) & (({ "error"?: ({ "code"?: ("IDEMPOTENCY_CONFLICT" | "TREEHOLE_CASE_ALREADY_RESOLVED" | "TREEHOLE_CASE_NOT_ACTIONABLE") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
    }
  }
  listAdminAppeals: {
    method: "GET"
    path: "/admin-api/treehole/appeals"
    request: { query?: { "page"?: (number); "pageSize"?: (10); "status"?: AppealStatus } }
    responses: {
      200: AdminAppealPage
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("FORBIDDEN") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
    }
  }
  getAdminAppeal: {
    method: "GET"
    path: "/admin-api/treehole/appeals/{appealId}"
    request: { pathParams: { "appealId": Id } }
    responses: {
      200: AdminAppealDetail
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("FORBIDDEN") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_CASE_NOT_FOUND") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
    }
  }
  decideAdminAppeal: {
    method: "POST"
    path: "/admin-api/treehole/appeals/{appealId}/decision"
    request: { pathParams: { "appealId": Id }; headers: { "Idempotency-Key": (string) }; body: AppealDecision }
    responses: {
      200: AppealDecisionResult
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("FORBIDDEN") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_CASE_NOT_FOUND") }) }))
      409: (Error) & (({ "error"?: ({ "code"?: ("IDEMPOTENCY_CONFLICT" | "TREEHOLE_CASE_ALREADY_RESOLVED" | "TREEHOLE_CASE_NOT_ACTIONABLE") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
    }
  }
  revokeAdminPenalty: {
    method: "POST"
    path: "/admin-api/treehole/penalties/{penaltyId}/revoke"
    request: { pathParams: { "penaltyId": Id }; headers: { "Idempotency-Key": (string) }; body: RevokePenalty }
    responses: {
      200: RevokePenaltyResult
      400: (Error) & (({ "error"?: ({ "code"?: ("VALIDATION_ERROR") }) }))
      401: (Error) & (({ "error"?: ({ "code"?: ("UNAUTHORIZED") }) }))
      403: (Error) & (({ "error"?: ({ "code"?: ("FORBIDDEN") }) }))
      404: (Error) & (({ "error"?: ({ "code"?: ("TREEHOLE_CASE_NOT_FOUND") }) }))
      409: (Error) & (({ "error"?: ({ "code"?: ("IDEMPOTENCY_CONFLICT" | "TREEHOLE_CASE_ALREADY_RESOLVED" | "TREEHOLE_CASE_NOT_ACTIONABLE") }) }))
      500: (Error) & (({ "error"?: ({ "code"?: ("INTERNAL_ERROR") }) }))
    }
  }
}

export type TreeholeOperationId = keyof TreeholeOperations
export type TreeholeRequest<K extends TreeholeOperationId> = TreeholeOperations[K]["request"]
export type TreeholeResponse<K extends TreeholeOperationId, S extends keyof TreeholeOperations[K]["responses"]> = TreeholeOperations[K]["responses"][S]
