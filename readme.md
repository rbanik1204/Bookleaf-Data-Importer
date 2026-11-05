## Known Limitations & Testing Constraints

### 1. Bubble Free-Plan Workflow Execution Limit

The application was developed and tested using Bubble's Free plan. During end-to-end testing, Bubble reached the workflow execution limit imposed by the free tier.

**Impact:**

- The workflow successfully creates a `NotificationLog` record with the initial status set to `processing`.
- The subsequent API Connector action, which sends the author's royalty data to the n8n webhook, may not execute once the plan's workflow limit has been reached.
- Consequently, the final workflow step that updates the notification record with the generated summary and changes its status to `success` cannot complete in those cases.
- Such records may remain in the `processing` state, with their generated content and error message fields empty.

### 2. n8n Integration Verification

The n8n automation was independently tested using production webhook executions.

The following functionality was successfully verified:

- Receiving author details and book-level royalty data from Bubble.
- Processing multiple books belonging to an author.
- Generating personalised royalty summaries using an AI language model.
- Calculating consolidated royalty figures, including total earned, paid, and pending royalties.
- Returning a structured JSON response containing the author ID, author name, success status, and generated summary.

### 3. Bulk Notification Testing

The bulk notification workflow and Notification Log interface were implemented in Bubble.

However, complete end-to-end bulk execution could not be consistently verified after the Free-plan workflow execution limit was reached. Therefore, some notification records may remain in `processing` rather than reaching their final status.

### 4. Resolution

The limitation is associated with the Bubble plan's workflow execution allowance rather than the n8n summary-generation logic.

With sufficient Bubble workflow execution capacity, the complete sequence can run:

1. Create a notification log.
2. Send author and book data to the n8n webhook.
3. Receive the generated royalty summary.
4. Update the notification log with the generated content and `success` status.
5. Record failures where applicable.

**Note:** No notification is marked as successful unless the corresponding API action returns a successful response.
