# BookLeaf — Author Royalty Dashboard & Automated Notification System

## 1. Project Overview

The BookLeaf Author Royalty Dashboard is a web application designed to help authors monitor their book sales and royalty earnings while enabling administrators to generate personalized, AI-powered royalty summaries.

The application is built using **Bubble.io** as the frontend, database and application platform, with **n8n** handling workflow automation and AI integration.

The system provides two primary interfaces:

- **Author Portal:** Authors can securely view their books, royalty figures, payout status and consolidated earnings.
- **Admin Portal:** Administrators can manage author-level visibility, inspect royalty information, filter records and trigger individual or bulk AI-generated royalty summaries.

## 2. Technology Stack

| Component                 | Technology                           |
| ------------------------- | ------------------------------------ |
| Application platform      | Bubble.io                            |
| Database                  | Bubble Database                      |
| Workflow automation       | n8n Cloud                            |
| AI integration            | OpenAI Chat Model                    |
| AI model                  | GPT-5-mini                           |
| API communication         | HTTP Webhooks / Bubble API Connector |
| Authentication            | Bubble email/password authentication |
| Workflow request tracking | n8n Data Tables                      |

## 3. System Architecture

The application follows a workflow-driven architecture.

1. Users authenticate through Bubble.
2. Bubble identifies the user's role and provides the appropriate dashboard.
3. Authors access only their associated books and royalty information.
4. Administrators can access all author records and trigger royalty summaries.
5. Bubble sends the author's information, book records and a unique request ID to an authenticated n8n webhook.
6. n8n validates the request and prepares structured input for the AI model.
7. The AI generates a personalized royalty summary.
8. n8n returns the generated summary to Bubble.
9. Bubble updates the corresponding NotificationLog record.

The full author and book payload is sent from Bubble to n8n. This approach avoids an additional Bubble Data API fetch during each summary-generation request.

## 4. Bubble Database Design

The database is organized around separate data types with explicit relationships.

### 4.1 Author

Stores author profile information.

| Field       | Purpose                  |
| ----------- | ------------------------ |
| author_id   | Unique author identifier |
| name        | Author's full name       |
| email       | Author's email           |
| phone       | Contact number           |
| city        | Author's city            |
| joined_date | Registration date        |
| user        | Associated Bubble User   |

### 4.2 Book

Stores book information and royalty metrics.

| Field                    | Purpose                            |
| ------------------------ | ---------------------------------- |
| book_id                  | Unique book identifier             |
| title                    | Book title                         |
| isbn                     | ISBN                               |
| genre                    | Book category                      |
| publication_date         | Publication date                   |
| status                   | Publication or production status   |
| mrp                      | Maximum retail price               |
| author_royalty_per_copy  | Royalty per copy                   |
| total_copies_sold        | Total copies sold                  |
| total_royalty_earned     | Total royalty earned               |
| royalty_paid             | Royalty already paid               |
| royalty_pending          | Outstanding royalty                |
| last_royalty_payout_date | Most recent payout date            |
| print_partner            | Printing partner                   |
| available_on             | Distribution platforms             |
| author                   | Reference to the associated Author |
| author_id                | Author identifier                  |

The `author` field establishes the relationship between books and authors. This makes it possible to retrieve an author's books through a relational reference instead of relying only on text identifiers.

### 4.3 NotificationLog

Stores the history of royalty-summary generation requests.

| Field             | Purpose                           |
| ----------------- | --------------------------------- |
| author            | Associated Author                 |
| request_id        | Unique request identifier         |
| status            | Notification processing status    |
| triggered_at      | Request timestamp                 |
| generated_content | AI-generated summary              |
| error_message     | Error information, when available |

### 4.4 User

Bubble's built-in User data type is extended with:

- `role`: Identifies an administrator or author.
- `author_profile`: Reference to the associated Author record.

This allows the application to associate authentication identities with author profiles.

### Database rationale

The database separates user authentication, author profiles, book records and notification history. This avoids mixing operational information into a single data type and supports independent privacy rules and queries.

The supplied dataset was imported into Bubble, containing 10 author records and 18 book records.

## 5. Authentication and Privacy

Bubble email/password authentication is used for user login.

After authentication, the application checks the user's role and redirects them to the appropriate dashboard.

Privacy rules are configured at the database level:

- Administrators can access all author, book and notification records.
- Authors can access their own Author record.
- Authors can access only books associated with their author profile.
- Notification logs are restricted to administrators.

Page-level role checks provide an additional access-control layer.

Database privacy rules are used alongside page-level restrictions so that access control does not depend only on navigation.

## 6. Author Portal

The author dashboard provides a consolidated view of an author's royalty information.

### Features

- Displays the author's associated books.
- Shows book title, ISBN, genre, publication status, publication date, MRP and platform availability.
- Displays copies sold, royalty earned, royalty paid and royalty pending for each book.
- Calculates consolidated earned, paid and pending royalty totals.
- Displays visual royalty-status indicators.

### Royalty status logic

Three visual states are used:

- **Green — Fully Paid:** No outstanding royalty remains.
- **Yellow — Pending:** An outstanding royalty exists but is within the normal payout cycle.
- **Red — Overdue:** An outstanding royalty exists and the last payout is older than 90 days, or no payout has been made for a published book older than 90 days.

These indicators help authors understand their payout position without manually interpreting individual dates and figures.

## 7. Admin Portal

The admin dashboard provides an overview of all authors and their royalty information.

### Author overview

Administrators can view:

- Author name and city.
- Total number of books.
- Total royalty earned.
- Total pending royalty.

The dashboard supports:

- Author-name search.
- City filtering.
- Payout-status filtering.

### Author detail view

Selecting an author opens a detailed view containing their profile, associated books and royalty figures.

The application displays the available royalty information from the supplied dataset.

**Dataset limitation:** Individual payout transaction records were not supplied in the dataset. Therefore, the application displays the available last-payout information rather than fabricating a transaction-level payout history.

### Individual royalty summary

The administrator can trigger the **Generate & Send Royalty Summary** action from an author's detail page.

### Bulk royalty summary

The admin dashboard also provides a bulk trigger that invokes the same n8n webhook for eligible authors with pending royalties.

### Notification log

The NotificationLog data type records summary-generation requests, including the author, request ID, timestamp, generated content and processing status.

## 8. Bubble–n8n Integration

Bubble communicates with n8n through an authenticated HTTP webhook.

### Request payload

The webhook receives structured information containing:

- Author ID.
- Author name.
- Email address.
- Phone number.
- City.
- Joining date.
- Book records and their royalty information.
- Unique request ID.

### Workflow sequence

1. **Webhook:** Receives the POST request from Bubble.
2. **Validate Request:** Checks the incoming payload and required fields.
3. **Request ID validation:** Checks the request identifier.
4. **Idempotency checks:** Uses the n8n Data Table to track request processing and prevent duplicate processing.
5. **Prepare AI Input:** Structures the author and book information for the language model.
6. **Basic LLM Chain:** Sends the prepared information to the OpenAI Chat Model.
7. **AI Output Validation:** Checks whether the generated summary is a usable text response.
8. **Response:** Returns the generated summary and author information to Bubble.

The integration uses the full payload approach instead of fetching the same records again through the Bubble Data API.

## 9. AI Prompt Strategy

The AI model is instructed to generate a professional, personalized royalty-summary email using the supplied author and book information.

The prompt emphasizes factual accuracy and prohibits inventing missing information.

### Expected summary structure

1. Personalized greeting using the author's name.
2. Individual summaries of published books.
3. Copies sold and royalty figures for each book.
4. Consolidated earned, paid and pending amounts.
5. Explanation of the quarterly payout cycle and 45-day payout window where applicable.
6. A positive acknowledgment when all royalties are paid.
7. Production updates for books that are not yet published.
8. A warm and professional closing.

### Accuracy instructions

The prompt instructs the model to:

- Use only the supplied data.
- Avoid inventing payout dates or contact details.
- Distinguish overdue royalty from normal pending royalty.
- Reconcile total earned, paid and pending figures.
- Avoid presenting production-stage books as published books.
- Clearly explain missing or unavailable information.

The output is returned as human-readable text and stored in Bubble's NotificationLog.

## 10. Security and Reliability

### Webhook authentication

The n8n webhook uses Header Authentication with a shared secret. Bubble sends the corresponding authentication header when making the request.

This prevents the webhook from being treated as an unrestricted public endpoint.

### Request validation

The workflow validates incoming data before processing it. Invalid payloads and missing or malformed request identifiers are rejected.

### Idempotency

A unique request ID is generated for each request.

The n8n Data Table tracks request IDs and their processing outcomes. This helps prevent duplicate processing and provides a record of request execution.

### AI output validation

The generated response is checked to ensure it is a sufficiently long text response before being treated as usable output.

### Error handling and limitations

The workflow includes validation and error-handling branches for invalid requests and unusable AI output.

Bubble also evaluates the webhook response before updating the corresponding notification record.

The successful summary-generation and NotificationLog update path has been tested. The failed-generation status-update path was not fully verified during final testing and is therefore not represented as a confirmed end-to-end capability.

## 11. Testing and Verification

The following application features were implemented and tested:

| Feature                             | Verification       |
| ----------------------------------- | ------------------ |
| Author login                        | Tested             |
| Admin login                         | Tested             |
| Role-based dashboard routing        | Configured         |
| Author-specific book visibility     | Tested             |
| Admin author overview               | Tested             |
| Author-name search                  | Tested             |
| City filtering                      | Tested             |
| Payout-status filtering             | Tested             |
| Author detail view                  | Tested             |
| Green/yellow/red royalty indicators | Tested             |
| Individual summary generation       | Tested             |
| Bulk summary generation             | Tested             |
| AI-generated summary content        | Tested             |
| NotificationLog success update      | Tested             |
| Webhook authentication              | Configured         |
| Request validation                  | Implemented        |
| Idempotency tracking                | Implemented        |
| Failed-generation status update     | Not fully verified |

## 12. Challenges and Learning Outcomes

This assignment involved learning and implementing a technology stack that was initially unfamiliar.

### Bubble.io

Working with Bubble required understanding its visual programming model, database relationships, repeating groups, dynamic expressions, workflows, privacy rules and API Connector.

A key learning experience was implementing database-level access restrictions alongside role-based page navigation.

### n8n

The automation workflow required understanding webhook execution, node connections, data transformation, conditional branching, AI model integration and request tracking.

Debugging payload serialization and webhook responses helped develop a better understanding of how data moves between independent platforms.

### AI integration

Designing the AI prompt required balancing readability with factual accuracy. The prompt was refined to account for overdue royalties, pending payments, production-stage books and numerical reconciliation.

### Integration

Connecting Bubble and n8n required careful handling of JSON payloads, request identifiers, authentication headers and API responses.

The project strengthened practical understanding of low-code platforms, workflow automation and AI-powered application integration.

## 13. Setup and Access Information

### Bubble application

- Application name: BookLeaf Royalty Dashboard
- Live application URL: [ADD LIVE URL]
- Admin test account: [ADD ADMIN EMAIL]
- Admin password: [SHARE SECURELY]
- Author test account: [ADD AUTHOR EMAIL]
- Author password: [SHARE SECURELY]

### n8n

- Workflow name: BookLeaf Royalty Notification
- Workspace URL: [ADD N8N WORKSPACE URL]
- Workflow export: `BookLeaf_Royalty_Notification.json`

### Configuration notes

The application requires the configured Bubble application, n8n workflow, webhook authentication header and AI model credentials.

Credentials and shared secrets must be supplied through secure configuration and should not be committed to exported documentation or source files.

## 14. Conclusion

The BookLeaf Author Royalty Dashboard demonstrates an integrated application built with Bubble.io, n8n and AI.

It provides authors with visibility into their royalty information, gives administrators tools to inspect author records and trigger royalty summaries, and uses an automated workflow to generate personalized AI content.

The project provided practical experience in visual application development, database design, privacy configuration, workflow automation, API integration and prompt engineering.

**Project:** Author Royalty Dashboard & Automated Notification System  
**Platform:** Bubble.io + n8n + OpenAI  
**Purpose:** Author royalty visibility and AI-powered royalty summary generation

## Known Testing Constraints

### 1. HTTP 422 – JSON Serialization and API Payload Debugging

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

# Challenge 4: End-to-End Workflow Documentation and Integration Debugging

## 1. Overview

This challenge involved documenting the complete royalty-summary generation workflow implemented using Bubble.io, n8n, and an AI language model.

The objective was to allow an administrator to trigger a personalised royalty summary for an individual author, generate the content using AI, return the result to Bubble, and display and record the generated summary in the application.

The implementation required careful coordination between Bubble's database and workflow engine, n8n's webhook-based automation, request validation, duplicate-request protection, AI generation, and response handling.

An additional four hours of debugging were required to resolve issues involving request IDs, API Connector initialisation, duplicate replay, and payload validation.

## 2. Technology Stack

| Component            | Responsibility                                  |
| -------------------- | ----------------------------------------------- |
| Bubble.io            | User interface, database, application workflows |
| n8n                  | Workflow orchestration and automation           |
| Webhook              | Receives requests from Bubble                   |
| OpenAI Chat Model    | Generates personalised royalty summaries        |
| n8n Data Table       | Tracks requests and supports idempotency        |
| Bubble API Connector | Connects Bubble workflows with n8n              |

## 3. Overall Architecture

The integration follows this sequence:

1. An administrator opens an author's details page.
2. The administrator clicks **Generate & Send Royalty Summary**.
3. Bubble creates a NotificationLog record with a unique request ID.
4. Bubble collects the author's information and associated book records.
5. Bubble sends the payload to the n8n production webhook.
6. n8n authenticates and validates the incoming request.
7. n8n checks whether the request has already been processed.
8. Valid new requests proceed to AI generation.
9. The AI generates a personalised royalty summary.
10. n8n returns the generated content through the webhook response.
11. Bubble updates the corresponding NotificationLog record.
12. Bubble displays the generated summary on the author details page.

## 4. Bubble.io Workflow Implementation

### 4.1 Administrator action

A button named **Generate & Send Royalty Summary** was implemented on the administrator's author details page.

The workflow uses the current page's Author data rather than fixed author information.

The button workflow contains the following steps.

### Step 1: Create a NotificationLog record

A new NotificationLog record is created before sending the request.

The following fields are populated:

- Author: Current page's Author
- Status: `processing`
- Triggered At: Current date/time
- Request ID: Dynamically generated using Bubble's RandomString calculation

The request ID uniquely identifies the individual generation request.

### Step 2: Call the n8n API

Bubble invokes the API Connector action named:

`BookLeaf n8n Integration - Generate Royalty Summary`

The request includes:

- Author ID
- Author name
- Email
- Phone number
- City
- Joining date
- Associated books in JSON format
- Request ID generated in Step 1

The request ID is mapped dynamically:

`Result of Step 1 (Create a new NotificationLog)'s request_id`

The books are retrieved using the current page's Author as the search constraint, ensuring that only the selected author's books are included.

### Step 3: Update NotificationLog on success

When the API response indicates success, Bubble updates the NotificationLog record created in Step 1.

The fields include:

- Generated Content: Result of Step 2's generated summary
- Request ID: Result of Step 2's request ID
- Status: `success`

The action runs only when the API response's `success` value is yes.

### Step 4: Handle API errors

A separate workflow action handles API errors when the API Connector returns an error.

The record is updated with:

- Status: `failed`
- Error Message: Result of Step 2's returned error

This prevents an unsuccessful API request from being recorded as a successful generation.

### Step 5: Display the generated summary

A custom state named `generated_summary` was implemented on the Royalty Summary group.

The state is populated from the generated content saved in the NotificationLog record.

The summary is displayed dynamically rather than using hardcoded author-specific content.

## 5. n8n Workflow Implementation

The n8n workflow is named:

`BookLeaf Royalty Notification`

It handles authentication, validation, idempotency, AI generation, and webhook responses.

### 5.1 Webhook

The workflow begins with a POST Webhook node.

It receives the request from Bubble through the production webhook URL.

Header authentication is enabled using a shared secret configured in Bubble's API Connector.

### 5.2 Validate Request

The Validate Request node checks the incoming payload.

It validates the required author information, book data, and request ID.

Invalid requests are routed to the invalid-request response instead of proceeding to AI generation.

### 5.3 Payload validation

The Is Payload Valid? condition separates valid and invalid requests.

Invalid requests receive an HTTP 400 response with an appropriate error code and message.

### 5.4 Idempotency and duplicate protection

A request-tracking mechanism was implemented using an n8n Data Table named:

`bookleaf_royalty_requests`

The workflow checks whether a request ID already exists.

The request is evaluated against its current state:

- New or retry: The workflow proceeds with processing.
- Already completed: The previously generated response is returned through duplicate replay.
- In progress: The workflow returns an in-progress response.

This prevents the same request from generating duplicate AI summaries.

### 5.5 Claim Request

A new request is claimed in the tracking table before AI generation.

This helps prevent concurrent duplicate processing.

### 5.6 Prepare AI Input

The Prepare AI Input node structures the incoming data into a clean format.

It prepares:

- Author information
- Books JSON array
- Book count
- Request ID

The AI node receives structured data instead of relying on hardcoded author details.

### 5.7 AI Summary Generation

The Basic LLM Chain uses an OpenAI Chat Model to generate the royalty summary.

The prompt instructs the model to produce a personalised communication containing:

- Personalised greeting
- Individual book details
- Sales and royalty figures
- Total earned royalties
- Total paid royalties
- Pending royalties
- Quarterly payout information
- The applicable 45-day processing window
- Publication and distribution information
- A professional closing

The model is instructed to use the supplied data and avoid unsupported payment-date promises.

### 5.8 AI output validation

The Is AI Output Usable? condition checks whether the generated text is a valid string and contains at least 200 characters.

The workflow separates usable AI output from empty or insufficient responses.

### 5.9 Response handling

The workflow contains dedicated response paths.

| Scenario                    | Response                        |
| --------------------------- | ------------------------------- |
| Successful AI generation    | HTTP 200 with generated summary |
| Invalid payload             | HTTP 400                        |
| AI generation failure       | HTTP 502                        |
| Empty AI output             | HTTP 502                        |
| Duplicate completed request | Previously generated response   |
| Request already processing  | In-progress response            |

The success response contains:

- `success`
- `author_id`
- `author_name`
- `generated_summary`

### 5.10 Record Outcome

The Record Outcome node saves the processing result in the n8n Data Table.

It records information such as:

- Request ID
- Processing status
- Error code
- Generated summary
- Completion timestamp
- Execution ID

This provides an internal record of workflow execution.

## 6. Four Hours of Debugging: Problems and Resolutions

The most challenging part of this implementation was ensuring that each author received their own generated summary instead of a previously generated response.

### Issue 1: Incorrect author summary displayed

**Problem:**

When generating a royalty summary for another author, the application continued displaying Priya Sharma's previously generated summary.

**Investigation:**

The n8n execution history showed that the workflow was returning a duplicate replay response.

The request ID was being reused, causing the idempotency mechanism to return the previously stored result.

**Resolution:**

The Bubble workflow was inspected to verify that the request ID was generated dynamically and passed from Step 1 to Step 2.

The API Connector initialization sample was also identified as a separate source of confusion because its sample request ID could appear in initialization responses.

### Issue 2: API Connector initialization failure

**Problem:**

Reinitializing the Bubble API Connector with an empty request ID returned an HTTP 400 error.

The n8n validation response indicated that the request ID was required and had to satisfy the configured length and character restrictions.

**Resolution:**

A valid initialization value was supplied:

`init-request-12345678`

The API Connector then initialized successfully.

This initialization value was used only as sample data and was not intended to become the runtime request ID.

### Issue 3: Random request ID and duplicate replay

**Problem:**

The workflow continued receiving the initialization request ID instead of a fresh runtime value.

The investigation revealed that the RandomString calculation and its character settings needed correction.

**Resolution:**

The RandomString calculation in Bubble was configured with:

- Length: 32 characters
- Use letters: Enabled
- Use lowercase letters: Enabled
- Use numbers: Enabled
- Use special characters: Disabled

The special-character setting was particularly important because n8n's validation accepted only letters, digits, underscores, and hyphens.

### Issue 4: n8n rejected the generated request ID

**Problem:**

A generated request ID looked like:

`XxTCY!#}oAoSB945+Q3o4~#XJ1ZT!xLy`

Although it was sufficiently long, n8n rejected it with:

`INVALID_PAYLOAD: request_id must be 8-128 characters (letters, digits, _ or -).`

**Root cause:**

Bubble's RandomString calculation was generating special characters that were not permitted by the n8n validation logic.

**Resolution:**

Special characters were disabled in the RandomString calculation.

A new request ID was generated using only permitted characters.

The next execution successfully passed payload validation and proceeded through AI generation.

### Issue 5: Callback failure on Bubble Free plan

**Problem:**

An additional n8n HTTP Request callback was initially implemented to update Bubble's NotificationLog directly.

The callback failed with HTTP 401 and the message:

`This application does not expose an API. Please upgrade your Bubble subscription for your API calls to run.`

**Resolution:**

The callback was removed from the n8n workflow.

The implementation was simplified to use the webhook response already received by Bubble's API Connector.

Bubble now updates the NotificationLog using the result of its own API Connector action.

This avoided depending on an additional incoming Bubble Workflow API call that was unavailable under the current plan.

## 7. Security and Reliability

The implementation includes several safeguards:

- Header authentication for incoming n8n webhook requests.
- Payload validation before AI generation.
- Request ID validation.
- Duplicate-request protection through an n8n Data Table.
- Separate handling for invalid requests, AI failures, and empty AI output.
- Tracking of completed and failed processing outcomes.
- Bubble-side NotificationLog updates based on API results.

The callback endpoint was removed because it was not compatible with the current Bubble plan. The final implementation relies on Bubble initiating the request and processing the returned response.

## 8. Final Testing and Verification

The integration was tested using multiple author records.

The final successful test confirmed that:

1. The selected author's information was sent from Bubble.
2. A unique request ID was generated dynamically.
3. The request passed n8n validation.
4. Duplicate protection did not incorrectly replay another author's result.
5. The AI generated a personalised royalty summary using the supplied author's data.
6. n8n returned the generated content through the webhook.
7. Bubble received and displayed the generated summary.
8. The NotificationLog success workflow could update the corresponding record.

A particularly important final test involved Vikram Joshi (AUTH004).

The initial request was rejected because the generated request ID contained unsupported special characters. After disabling special characters in Bubble's RandomString calculation, the request passed validation and the summary generation worked successfully.

## 9. Final Outcome

The individual royalty-summary generation workflow was successfully implemented and tested.

The final architecture uses Bubble as the application and database layer, n8n as the automation and orchestration layer, and an OpenAI language model for personalised royalty-summary generation.

The debugging process also reinforced the importance of:

- Dynamic runtime values versus API initialization samples.
- Consistent request ID generation and validation.
- Idempotency and duplicate-request handling.
- Inspecting actual execution data instead of relying only on UI behaviour.
- Designing integrations around the limitations of the selected platform plan.

**Key lesson:** A successful integration requires more than connecting two APIs. Data identity, validation rules, request lifecycle, error handling, and response mapping must all work together reliably.
{{ typeof $json.text === "string" && $json.text.trim().length >= 200 }}
{{ typeof $json.text === "string" && $json.text.trim().length >= 200 }}
