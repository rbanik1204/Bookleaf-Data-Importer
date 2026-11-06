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

### 2. HTTP 422 – JSON Serialization and API Payload Debugging

During the initial Bubble-to-n8n integration, the API request returned an HTTP 422 error with the following parsing message:

```text
Expected ',' or '}' after property value
at position 242 (line 10 column 30)
```

This indicated that the receiving endpoint could not parse the submitted JSON correctly.

Approximately six hours were spent investigating the issue across Bubble's API Connector, dynamic expressions, request construction, and n8n webhook executions.

**Investigation and corrections:**

1. **API Connector request structure:** Reviewed the POST request body and its dynamic parameters to ensure that the author object and book data were represented as valid JSON.

2. **Dynamic book-array serialization:** Investigated how Bubble's `Search for Books:format as text` expression generated the `books_json` parameter from database records.

3. **JSON-safe string formatting:** Configured text fields using Bubble's `:formatted as JSON-safe` operator to prevent special characters and quotation marks from breaking JSON syntax.

4. **Date and numeric handling:** Formatted date values as JSON-safe strings while keeping numerical values such as MRP, copies sold, earned royalties, paid royalties, and pending royalties as numbers rather than quoted strings.

5. **Array structure correction:** Ensured that `books_json` was inserted into the request body as a raw JSON array, without enclosing the entire array in quotation marks or adding another unnecessary pair of square brackets.

6. **Nested platform data:** Checked the serialization of the `available_on` list so that its values were represented correctly within each book object.

**Final request-body structure:**

The corrected API request followed this structure:

```json
{
  "author": {
    "author_id": "<author_id>",
    "name": "<name>",
    "email": "<email>",
    "phone": "<phone>",
    "city": "<city>",
    "joined_date": "<joined_date>"
  },
  "books_json": [
    {
      "book_id": "<book_id>",
      "title": "<title>",
      "isbn": "<isbn>",
      "genre": "<genre>",
      "publication_date": "<publication_date>",
      "status": "<status>",
      "mrp": 350,
      "royalty_per_copy": 30,
      "copies_sold": 876,
      "total_earned": 26280,
      "royalty_paid": 21000,
      "royalty_pending": 5280,
      "last_payout_date": "<last_payout_date>",
      "print_partner": "Repro India",
      "available_on": ["Amazon India", "Flipkart"]
    }
  ]
}
```

The values above illustrate the payload structure using the Code & Karma book. Actual values are dynamically populated from Bubble's database.

**Production verification:**

The corrected payload was subsequently inspected in an actual n8n production execution for author `AUTH002` (Rohit Kapoor).

The webhook successfully received:

- Author ID: `AUTH002`
- Author name: Rohit Kapoor
- Email: `rohit.kapoor@email.com`
- Two book records: `BK003` and `BK004`
- Complete book-level royalty figures and distribution information.

The n8n workflow then successfully generated a personalised royalty summary and returned the generated content through the Respond to Webhook node.

This verified the Bubble-to-n8n data contract and demonstrated that the integration could process multiple books for an individual author.

### 3. n8n AI Summary Generation

The n8n automation was independently verified through successful production executions.

Implemented functionality:

- Receives author details and book-level royalty data through a webhook.
- Processes multiple books belonging to one author.
- Uses an AI language model to generate personalised royalty summaries.
- Calculates consolidated copies sold, total earned, total paid, and total pending royalties.
- Explains the quarterly payout cycle and the 45-day processing window.
- Includes individual book details, publication status, print partner, and distribution platforms.
- Returns a structured response containing `success`, `author_id`, `author_name`, and `generated_summary`.

### 4. Bulk Notification Workflow

The bulk notification workflow and Notification Log interface were implemented in Bubble.

The workflow is designed to:

1. Identify authors with pending royalties.
2. Schedule or trigger individual author-summary workflows.
3. Create a NotificationLog record for each author.
4. Send the corresponding author and book data to n8n.
5. Receive the generated royalty summary.
6. Update the corresponding notification record with its final status and generated content.

However, complete end-to-end bulk execution could not be consistently verified after Bubble's Free-plan workflow execution limit was reached. Some records therefore remain in `processing`.

### 5. Resolution and Remaining Constraints

The HTTP 422 investigation was followed by successful production webhook executions and successful AI summary generation.

The remaining testing limitation is the Bubble Free-plan workflow execution allowance, which prevents consistent verification of the complete Bubble-to-n8n-to-Bubble sequence.

With sufficient workflow execution capacity, the intended sequence can complete, including updating each notification record to `success` or recording an appropriate failure.

**Integrity note:** A notification is not considered successful merely because its initial log record was created. Its final status should reflect the result of the API execution.

# Challenge 3: AI-Powered Royalty Summary Generation & Notification Workflow

## Overview

This challenge implements an automated royalty summary generation system for the BookLeaf Author Royalty Dashboard using **Bubble.io, n8n, and Google Gemini**.

The system allows an administrator to trigger a royalty summary for an individual author. Bubble sends the author's information and associated book-level royalty data to an n8n webhook. The workflow validates the request, processes the data using an AI model, generates a personalised royalty summary, and returns the result to Bubble.

Bubble then stores the generated summary and updates the corresponding Notification Log entry.

## Technology Stack

- **Bubble.io** – Application frontend, database, backend workflows, and API integration.
- **n8n** – Workflow automation and request orchestration.
- **Google Gemini** – AI-powered royalty summary generation.
- **Bubble API Connector** – Communication between Bubble and n8n.
- **Webhook Authentication** – Secures incoming requests using a shared secret.

## System Architecture

```text
Admin Dashboard
      |
      v
Generate Royalty Summary Button
      |
      v
Bubble Backend Workflow
      |
      +--> Step 1: Create Notification Log
      |       - Associate Author
      |       - Generate unique request_id
      |       - Set status to processing
      |
      v
Step 2: Call n8n Webhook
      |
      v
n8n Workflow
      |
      +--> Validate Request
      |
      +--> Check Duplicate Request
      |
      +--> Prepare AI Input
      |
      +--> Generate Summary using Gemini
      |
      +--> Validate AI Output
      |
      +--> Return JSON Response
      |
      v
Bubble Receives API Response
      |
      v
Step 3: Update Notification Log
      - Save generated summary
      - Save request_id
      - Update status to success
```

## Workflow Implementation

### 1. Bubble: Notification Log Creation

When an administrator clicks the Generate & Send Royalty Summary button, Bubble creates a new NotificationLog record.

The record contains:

- Author reference
- Unique request ID
- Trigger timestamp
- Initial status: `processing`

A unique request ID is generated using Bubble's RandomString expression.

### 2. Bubble: n8n API Integration

Bubble invokes the configured API Connector action and sends:

- Author ID
- Author name
- Email address
- Phone number
- City
- Joining date
- Complete book-level royalty data
- Request ID

The books are dynamically retrieved using a search constrained to the current author.

The request ID is passed from Step 1 into Step 2 to maintain consistency across the workflow.

### 3. n8n: Request Validation

The incoming webhook request is validated before AI processing.

Validation includes checking:

- Request body structure
- Author object
- Required author information
- Book data structure
- Request ID format

Invalid requests are rejected with an appropriate error response.

### 4. Duplicate Request Protection

The workflow uses the request ID to identify duplicate requests and prevent repeated processing.

It also includes request-tracking logic to handle duplicate and in-progress requests.

### 5. AI-Powered Summary Generation

After validation, the workflow prepares the author and book data for the AI model.

Google Gemini generates a professional, personalised royalty summary.

The generated content includes:

- Personalised author greeting
- Individual book sales and royalty figures
- Total royalty earned
- Total royalty paid
- Total pending royalty
- Explanation of the quarterly payout cycle
- Applicable 45-day payout processing window
- Relevant publication and production updates

The AI is instructed to use the supplied data and avoid inventing figures or dates.

### 6. Response Handling

After successful generation, n8n returns a structured JSON response containing:

- `success`
- `author_id`
- `author_name`
- `generated_summary`

The response is consumed by Bubble through the API Connector.

### 7. Bubble: Notification Log Update

Bubble uses the result of Step 1 as the record to update.

The generated summary and request ID are populated using the result of Step 2. The status is changed from `processing` to `success` only when the API response indicates successful generation.

This maintains a consistent relationship between the original request and its final result.

## Request ID and Data Consistency

A unique request ID connects all three Bubble workflow steps.

| Workflow Step                   | Request ID                        |
| ------------------------------- | --------------------------------- |
| Step 1 – Create NotificationLog | Generate a unique RandomString    |
| Step 2 – Call n8n               | Pass Step 1's request ID          |
| Step 3 – Update NotificationLog | Save Step 2's returned request ID |

This approach ensures that the same request identifier is used throughout the complete operation.

**Important implementation detail:** The API Connector's `request_id` parameter must not be configured to allow blank values. Allowing blank values caused Bubble to send an empty request ID, which was rejected by n8n validation. This was resolved by generating the ID in Step 1 and passing it through the subsequent steps.

## Error Handling and Reliability

The workflow includes:

- Webhook authentication
- Request validation
- Duplicate request protection
- AI output validation
- Invalid request responses
- Error response handling
- Request tracking
- Notification Log status management

The NotificationLog data type provides a record of each generation request and its processing status.

## Testing and Verification

The following implementation checks were completed:

- Successful API Connector initialization.
- Dynamic author information passed from Bubble.
- Complete book data passed to n8n.
- Request ID generated in Bubble.
- Request ID successfully passed between all three Bubble workflow steps.
- n8n request validation.
- AI summary generation.
- Structured JSON response returned to Bubble.
- Generated summary saved in the corresponding NotificationLog.
- Successful workflow execution from the administrator's author details page.

## Outcome

The third challenge establishes an automated integration between Bubble.io and n8n for AI-powered royalty summary generation.

It demonstrates the use of webhook-based communication, backend workflow orchestration, request validation, idempotency-oriented request tracking, AI integration, structured API responses, and persistent notification logging.

The result is a functional workflow that connects an administrator's action to AI-generated author royalty summaries while maintaining request-level traceability.
