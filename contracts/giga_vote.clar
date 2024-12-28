;; GigaVote - Decentralized Opinion Polls
;; Error codes
(define-constant ERR_POLL_NOT_FOUND (err u100))
(define-constant ERR_POLL_EXPIRED (err u101))
(define-constant ERR_ALREADY_VOTED (err u102))
(define-constant ERR_INVALID_OPTION (err u103))

;; Data structures
(define-map polls
    { poll-id: uint }
    {
        creator: principal,
        question: (string-ascii 256),
        options: (list 10 (string-ascii 64)),
        end-block: uint,
        total-votes: uint
    }
)

(define-map votes
    { poll-id: uint, voter: principal }
    { option-index: uint }
)

(define-map poll-results
    { poll-id: uint, option-index: uint }
    { votes: uint }
)

;; Data variables
(define-data-var current-poll-id uint u0)

;; Private functions
(define-private (increment-poll-id)
    (let ((current (var-get current-poll-id)))
        (var-set current-poll-id (+ current u1))
        (var-get current-poll-id)
    )
)

;; Public functions
(define-public (create-poll (question (string-ascii 256)) (options (list 10 (string-ascii 64))) (duration uint))
    (let
        (
            (poll-id (increment-poll-id))
            (end-block (+ block-height duration))
        )
        (map-set polls
            { poll-id: poll-id }
            {
                creator: tx-sender,
                question: question,
                options: options,
                end-block: end-block,
                total-votes: u0
            }
        )
        (ok poll-id)
    )
)

(define-public (vote (poll-id uint) (option-index uint))
    (let
        (
            (poll (unwrap! (map-get? polls { poll-id: poll-id }) ERR_POLL_NOT_FOUND))
            (poll-end (get end-block poll))
            (options-list (get options poll))
        )
        (asserts! (< block-height poll-end) ERR_POLL_EXPIRED)
        (asserts! (is-none (map-get? votes { poll-id: poll-id, voter: tx-sender })) ERR_ALREADY_VOTED)
        (asserts! (< option-index (len options-list)) ERR_INVALID_OPTION)
        
        ;; Record the vote
        (map-set votes
            { poll-id: poll-id, voter: tx-sender }
            { option-index: option-index }
        )
        
        ;; Update vote count
        (let
            (
                (current-votes (default-to { votes: u0 }
                    (map-get? poll-results { poll-id: poll-id, option-index: option-index })))
            )
            (map-set poll-results
                { poll-id: poll-id, option-index: option-index }
                { votes: (+ u1 (get votes current-votes)) }
            )
        )
        
        ;; Update total votes
        (map-set polls
            { poll-id: poll-id }
            (merge poll { total-votes: (+ u1 (get total-votes poll)) })
        )
        
        (ok true)
    )
)

;; Read-only functions
(define-read-only (get-poll-details (poll-id uint))
    (map-get? polls { poll-id: poll-id })
)

(define-read-only (get-poll-results (poll-id uint) (option-index uint))
    (default-to { votes: u0 }
        (map-get? poll-results { poll-id: poll-id, option-index: option-index })
    )
)

(define-read-only (has-voted (poll-id uint) (voter principal))
    (is-some (map-get? votes { poll-id: poll-id, voter: voter }))
)