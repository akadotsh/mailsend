export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;

  auth: {
    user: string;
    pass: string;
  };
}
