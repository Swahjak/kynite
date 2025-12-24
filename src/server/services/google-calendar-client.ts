import type {
  GoogleCalendarListResponse,
  GoogleEventsListResponse,
  GoogleCalendarEvent,
  GoogleApiError,
  GoogleWatchRequest,
  GoogleWatchResponse,
} from "@/types/google-calendar";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export class GoogleCalendarClient {
  constructor(private accessToken: string) {}

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${CALENDAR_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = (await response.json()) as GoogleApiError;
      throw new GoogleCalendarApiError(response.status, error);
    }

    return response.json() as Promise<T>;
  }

  /**
   * List all calendars accessible by this account
   */
  async listCalendars(): Promise<GoogleCalendarListResponse> {
    return this.fetch<GoogleCalendarListResponse>("/users/me/calendarList");
  }

  /**
   * Fetch events from a calendar with optional sync token
   */
  async listEvents(
    calendarId: string,
    options: {
      syncToken?: string;
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
      pageToken?: string;
    } = {}
  ): Promise<GoogleEventsListResponse> {
    const params = new URLSearchParams();

    if (options.syncToken) {
      params.set("syncToken", options.syncToken);
    } else {
      // Initial sync - use time bounds
      if (options.timeMin) params.set("timeMin", options.timeMin);
      if (options.timeMax) params.set("timeMax", options.timeMax);
      params.set("singleEvents", "true"); // Expand recurring events
    }

    if (options.maxResults)
      params.set("maxResults", String(options.maxResults));
    if (options.pageToken) params.set("pageToken", options.pageToken);

    const query = params.toString();
    return this.fetch<GoogleEventsListResponse>(
      `/calendars/${encodeURIComponent(calendarId)}/events${query ? `?${query}` : ""}`
    );
  }

  /**
   * Create an event on Google Calendar
   */
  async createEvent(
    calendarId: string,
    event: Partial<GoogleCalendarEvent>
  ): Promise<GoogleCalendarEvent> {
    return this.fetch<GoogleCalendarEvent>(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        body: JSON.stringify(event),
      }
    );
  }

  /**
   * Update an event on Google Calendar
   */
  async updateEvent(
    calendarId: string,
    eventId: string,
    event: Partial<GoogleCalendarEvent>
  ): Promise<GoogleCalendarEvent> {
    return this.fetch<GoogleCalendarEvent>(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(event),
      }
    );
  }

  /**
   * Delete an event from Google Calendar
   */
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    await this.fetch(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE" }
    );
  }

  /**
   * Watch a calendar for changes via push notifications
   */
  async watchEvents(
    calendarId: string,
    watchRequest: GoogleWatchRequest
  ): Promise<GoogleWatchResponse> {
    return this.fetch<GoogleWatchResponse>(
      `/calendars/${encodeURIComponent(calendarId)}/events/watch`,
      {
        method: "POST",
        body: JSON.stringify(watchRequest),
      }
    );
  }

  /**
   * Stop receiving notifications for a channel
   */
  async stopChannel(channelId: string, resourceId: string): Promise<void> {
    await this.fetch("/channels/stop", {
      method: "POST",
      body: JSON.stringify({ id: channelId, resourceId }),
    });
  }
}

export class GoogleCalendarApiError extends Error {
  constructor(
    public status: number,
    public apiError: GoogleApiError
  ) {
    super(apiError.error.message);
    this.name = "GoogleCalendarApiError";
  }

  get isRateLimited(): boolean {
    return (
      this.status === 429 ||
      this.apiError.error.errors?.[0]?.reason === "rateLimitExceeded"
    );
  }

  get requiresFullSync(): boolean {
    return this.status === 410;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}
