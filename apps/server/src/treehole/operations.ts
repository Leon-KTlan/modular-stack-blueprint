// Frozen V1 HTTP operation metadata; structure follows treehole-openapi-v1.json.
export const operations = [
  {
    "method": "GET",
    "path": "/api/miniapp/treehole/posts",
    "operation": "listTreeholePosts",
    "params": [
      {
        "name": "page",
        "in": "query",
        "schema": {
          "type": "integer",
          "minimum": 1,
          "maximum": 2147483647,
          "default": 1
        }
      },
      {
        "name": "pageSize",
        "in": "query",
        "schema": {
          "type": "integer",
          "const": 10,
          "default": 10
        }
      }
    ],
    "body": false
  },
  {
    "method": "POST",
    "path": "/api/miniapp/treehole/posts",
    "operation": "createTreeholePost",
    "params": [
      {
        "name": "Idempotency-Key",
        "in": "header",
        "required": true,
        "schema": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
        },
        "description": "必填 UUID；网络重试复用，修改参数必须使用新键。详见配套文档第 3 节。"
      }
    ],
    "body": true
  },
  {
    "method": "GET",
    "path": "/api/miniapp/treehole/posts/{postId}",
    "operation": "getTreeholePost",
    "params": [
      {
        "name": "postId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      }
    ],
    "body": false
  },
  {
    "method": "GET",
    "path": "/api/miniapp/treehole/posts/{postId}/comments",
    "operation": "listTreeholeComments",
    "params": [
      {
        "name": "postId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      },
      {
        "name": "page",
        "in": "query",
        "schema": {
          "type": "integer",
          "minimum": 1,
          "maximum": 2147483647,
          "default": 1
        }
      },
      {
        "name": "pageSize",
        "in": "query",
        "schema": {
          "type": "integer",
          "const": 10,
          "default": 10
        }
      }
    ],
    "body": false
  },
  {
    "method": "POST",
    "path": "/api/miniapp/treehole/posts/{postId}/comments",
    "operation": "createTreeholeComment",
    "params": [
      {
        "name": "postId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      },
      {
        "name": "Idempotency-Key",
        "in": "header",
        "required": true,
        "schema": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
        },
        "description": "必填 UUID；网络重试复用，修改参数必须使用新键。详见配套文档第 3 节。"
      }
    ],
    "body": true
  },
  {
    "method": "PUT",
    "path": "/api/miniapp/treehole/posts/{postId}/likes/me",
    "operation": "likeTreeholePost",
    "params": [
      {
        "name": "postId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      }
    ],
    "body": false
  },
  {
    "method": "DELETE",
    "path": "/api/miniapp/treehole/posts/{postId}/likes/me",
    "operation": "unlikeTreeholePost",
    "params": [
      {
        "name": "postId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      }
    ],
    "body": false
  },
  {
    "method": "POST",
    "path": "/api/miniapp/treehole/posts/{postId}/reports",
    "operation": "reportTreeholePost",
    "params": [
      {
        "name": "postId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      }
    ],
    "body": true
  },
  {
    "method": "POST",
    "path": "/api/miniapp/treehole/comments/{commentId}/reports",
    "operation": "reportTreeholeComment",
    "params": [
      {
        "name": "commentId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      }
    ],
    "body": true
  },
  {
    "method": "GET",
    "path": "/api/miniapp/me/treehole/access",
    "operation": "getMyTreeholeAccess",
    "params": [],
    "body": false
  },
  {
    "method": "GET",
    "path": "/api/miniapp/me/treehole/posts",
    "operation": "listMyPosts",
    "params": [
      {
        "name": "page",
        "in": "query",
        "schema": {
          "type": "integer",
          "minimum": 1,
          "maximum": 2147483647,
          "default": 1
        }
      },
      {
        "name": "pageSize",
        "in": "query",
        "schema": {
          "type": "integer",
          "const": 10,
          "default": 10
        }
      }
    ],
    "body": false
  },
  {
    "method": "GET",
    "path": "/api/miniapp/me/treehole/posts/{postId}",
    "operation": "getMyPost",
    "params": [
      {
        "name": "postId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      }
    ],
    "body": false
  },
  {
    "method": "DELETE",
    "path": "/api/miniapp/me/treehole/posts/{postId}",
    "operation": "deleteMyPost",
    "params": [
      {
        "name": "postId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      }
    ],
    "body": false
  },
  {
    "method": "GET",
    "path": "/api/miniapp/me/treehole/comments",
    "operation": "listMyComments",
    "params": [
      {
        "name": "page",
        "in": "query",
        "schema": {
          "type": "integer",
          "minimum": 1,
          "maximum": 2147483647,
          "default": 1
        }
      },
      {
        "name": "pageSize",
        "in": "query",
        "schema": {
          "type": "integer",
          "const": 10,
          "default": 10
        }
      }
    ],
    "body": false
  },
  {
    "method": "GET",
    "path": "/api/miniapp/me/treehole/comments/{commentId}",
    "operation": "getMyComment",
    "params": [
      {
        "name": "commentId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      }
    ],
    "body": false
  },
  {
    "method": "DELETE",
    "path": "/api/miniapp/me/treehole/comments/{commentId}",
    "operation": "deleteMyComment",
    "params": [
      {
        "name": "commentId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      }
    ],
    "body": false
  },
  {
    "method": "GET",
    "path": "/api/miniapp/me/treehole/penalties",
    "operation": "listMyTreeholePenalties",
    "params": [
      {
        "name": "page",
        "in": "query",
        "schema": {
          "type": "integer",
          "minimum": 1,
          "maximum": 2147483647,
          "default": 1
        }
      },
      {
        "name": "pageSize",
        "in": "query",
        "schema": {
          "type": "integer",
          "const": 10,
          "default": 10
        }
      }
    ],
    "body": false
  },
  {
    "method": "GET",
    "path": "/api/miniapp/me/treehole/penalties/{penaltyId}",
    "operation": "getMyTreeholePenalty",
    "params": [
      {
        "name": "penaltyId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      }
    ],
    "body": false
  },
  {
    "method": "POST",
    "path": "/api/miniapp/me/treehole/penalties/{penaltyId}/appeals",
    "operation": "createMyTreeholeAppeal",
    "params": [
      {
        "name": "penaltyId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      },
      {
        "name": "Idempotency-Key",
        "in": "header",
        "required": true,
        "schema": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
        },
        "description": "必填 UUID；网络重试复用，修改参数必须使用新键。详见配套文档第 3 节。"
      }
    ],
    "body": true
  },
  {
    "method": "GET",
    "path": "/api/miniapp/me/treehole/appeals",
    "operation": "listMyTreeholeAppeals",
    "params": [
      {
        "name": "page",
        "in": "query",
        "schema": {
          "type": "integer",
          "minimum": 1,
          "maximum": 2147483647,
          "default": 1
        }
      },
      {
        "name": "pageSize",
        "in": "query",
        "schema": {
          "type": "integer",
          "const": 10,
          "default": 10
        }
      }
    ],
    "body": false
  },
  {
    "method": "GET",
    "path": "/admin-api/treehole/reviews",
    "operation": "listAdminReviews",
    "params": [
      {
        "name": "page",
        "in": "query",
        "schema": {
          "type": "integer",
          "minimum": 1,
          "maximum": 2147483647,
          "default": 1
        }
      },
      {
        "name": "pageSize",
        "in": "query",
        "schema": {
          "type": "integer",
          "const": 10,
          "default": 10
        }
      },
      {
        "name": "status",
        "in": "query",
        "schema": {
          "type": "string",
          "enum": [
            "queued",
            "processing",
            "completed",
            "cancelled"
          ]
        }
      },
      {
        "name": "reviewerType",
        "in": "query",
        "schema": {
          "type": "string",
          "enum": [
            "rule",
            "ai",
            "human"
          ]
        }
      }
    ],
    "body": false
  },
  {
    "method": "GET",
    "path": "/admin-api/treehole/reviews/{reviewId}",
    "operation": "getAdminReview",
    "params": [
      {
        "name": "reviewId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      }
    ],
    "body": false
  },
  {
    "method": "POST",
    "path": "/admin-api/treehole/reviews/{reviewId}/decision",
    "operation": "decideAdminReview",
    "params": [
      {
        "name": "reviewId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      },
      {
        "name": "Idempotency-Key",
        "in": "header",
        "required": true,
        "schema": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
        },
        "description": "必填 UUID；网络重试复用，修改参数必须使用新键。详见配套文档第 3 节。"
      }
    ],
    "body": true
  },
  {
    "method": "GET",
    "path": "/admin-api/treehole/reports",
    "operation": "listAdminReports",
    "params": [
      {
        "name": "page",
        "in": "query",
        "schema": {
          "type": "integer",
          "minimum": 1,
          "maximum": 2147483647,
          "default": 1
        }
      },
      {
        "name": "pageSize",
        "in": "query",
        "schema": {
          "type": "integer",
          "const": 10,
          "default": 10
        }
      },
      {
        "name": "status",
        "in": "query",
        "schema": {
          "type": "string",
          "enum": [
            "pending",
            "upheld",
            "dismissed"
          ]
        }
      }
    ],
    "body": false
  },
  {
    "method": "GET",
    "path": "/admin-api/treehole/reports/{reportId}",
    "operation": "getAdminReport",
    "params": [
      {
        "name": "reportId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      }
    ],
    "body": false
  },
  {
    "method": "POST",
    "path": "/admin-api/treehole/reports/{reportId}/decision",
    "operation": "decideAdminReport",
    "params": [
      {
        "name": "reportId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      },
      {
        "name": "Idempotency-Key",
        "in": "header",
        "required": true,
        "schema": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
        },
        "description": "必填 UUID；网络重试复用，修改参数必须使用新键。详见配套文档第 3 节。"
      }
    ],
    "body": true
  },
  {
    "method": "GET",
    "path": "/admin-api/treehole/penalties",
    "operation": "listAdminPenalties",
    "params": [
      {
        "name": "page",
        "in": "query",
        "schema": {
          "type": "integer",
          "minimum": 1,
          "maximum": 2147483647,
          "default": 1
        }
      },
      {
        "name": "pageSize",
        "in": "query",
        "schema": {
          "type": "integer",
          "const": 10,
          "default": 10
        }
      },
      {
        "name": "status",
        "in": "query",
        "schema": {
          "type": "string",
          "enum": [
            "pending_confirmation",
            "active",
            "ended",
            "revoked",
            "superseded",
            "declined"
          ]
        }
      }
    ],
    "body": false
  },
  {
    "method": "GET",
    "path": "/admin-api/treehole/penalties/{penaltyId}",
    "operation": "getAdminPenalty",
    "params": [
      {
        "name": "penaltyId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      }
    ],
    "body": false
  },
  {
    "method": "POST",
    "path": "/admin-api/treehole/penalties/{penaltyId}/decision",
    "operation": "decideAdminPenalty",
    "params": [
      {
        "name": "penaltyId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      },
      {
        "name": "Idempotency-Key",
        "in": "header",
        "required": true,
        "schema": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
        },
        "description": "必填 UUID；网络重试复用，修改参数必须使用新键。详见配套文档第 3 节。"
      }
    ],
    "body": true
  },
  {
    "method": "GET",
    "path": "/admin-api/treehole/appeals",
    "operation": "listAdminAppeals",
    "params": [
      {
        "name": "page",
        "in": "query",
        "schema": {
          "type": "integer",
          "minimum": 1,
          "maximum": 2147483647,
          "default": 1
        }
      },
      {
        "name": "pageSize",
        "in": "query",
        "schema": {
          "type": "integer",
          "const": 10,
          "default": 10
        }
      },
      {
        "name": "status",
        "in": "query",
        "schema": {
          "type": "string",
          "enum": [
            "pending",
            "upheld",
            "rejected"
          ]
        }
      }
    ],
    "body": false
  },
  {
    "method": "GET",
    "path": "/admin-api/treehole/appeals/{appealId}",
    "operation": "getAdminAppeal",
    "params": [
      {
        "name": "appealId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      }
    ],
    "body": false
  },
  {
    "method": "POST",
    "path": "/admin-api/treehole/appeals/{appealId}/decision",
    "operation": "decideAdminAppeal",
    "params": [
      {
        "name": "appealId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      },
      {
        "name": "Idempotency-Key",
        "in": "header",
        "required": true,
        "schema": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
        },
        "description": "必填 UUID；网络重试复用，修改参数必须使用新键。详见配套文档第 3 节。"
      }
    ],
    "body": true
  },
  {
    "method": "POST",
    "path": "/admin-api/treehole/penalties/{penaltyId}/revoke",
    "operation": "revokeAdminPenalty",
    "params": [
      {
        "name": "penaltyId",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "pattern": "^[1-9][0-9]*$",
          "maxLength": 19,
          "description": "正十进制字符串；运行时还须校验 <= 9223372036854775807，禁止转 JS Number。"
        }
      },
      {
        "name": "Idempotency-Key",
        "in": "header",
        "required": true,
        "schema": {
          "type": "string",
          "format": "uuid",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
        },
        "description": "必填 UUID；网络重试复用，修改参数必须使用新键。详见配套文档第 3 节。"
      }
    ],
    "body": true
  }
] as const
