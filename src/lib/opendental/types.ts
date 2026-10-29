export interface OpenDentalPatient {
  PatNum: number;
  LName: string;
  FName: string;
  Birthdate?: string;
  HmPhone?: string;
  WirelessPhone?: string;
  Email?: string;
  PatStatus?: string;
  DateTStamp?: string;
}

export interface OpenDentalPatientDetails {
  PatNum: number;
  LName: string;
  FName: string;
  MiddleI?: string;
  Preferred?: string;
  PatStatus?: string;
  Birthdate?: string;
  HmPhone?: string;
  WkPhone?: string;
  WirelessPhone?: string;
  Email?: string;
  priProvAbbr?: string;
  secProvAbbr?: string;
  ChartNumber?: string;
  TxtMsgOk?: string;
}

export interface OpenDentalAppointment {
  AptNum: number;
  PatNum: number;
  AptDateTime: string;
  AptStatus?: string;
  ProcDescript?: string;
  DateTStamp?: string;
  Op?: number;
  ProvNum?: number;
  ProvHyg?: number;
  provAbbr?: string;
  IsHygiene?: string | boolean;
  Pattern?: string;
  IsNewPatient?: string | boolean;
  Confirmed?: number;
  confirmed?: string;
  Note?: string;
  ClinicNum?: number;
  patientName?: string;
  durationMinutes?: number;
  patientDetails?: OpenDentalPatientDetails;
  diseases?: string[];
}

export interface OpenDentalProvider {
  ProvNum: number;
  Abbr?: string;
  ItemOrder?: number;
  LName: string;
  FName: string;
  MI?: string;
  Suffix?: string;
  FeeSched?: number;
  Specialty?: number;
  SSN?: string;
  StateLicense?: string;
  IsSecondary?: string | boolean;
  provColor?: string;
  IsHidden?: string | boolean;
  UsingTIN?: string | boolean;
  SigOnFile?: string | boolean;
  NationalProvID?: string;
  DateTStamp?: string;
  IsNotPerson?: string | boolean;
  ProvStatus?: string;
  IsHiddenReport?: string | boolean;
  Birthdate?: string;
  SchedNote?: string;
  PreferredName?: string;
}

export interface OpenDentalOperatory {
  OperatoryNum: number;
  OpName: string;
  Abbrev?: string;
  ItemOrder?: number;
  IsHidden?: string | boolean;
  ProvDentist?: number;
  ProvHygienist?: number;
  IsHygiene?: string | boolean;
  ClinicNum?: number;
  SetProspective?: string | boolean;
  IsWebSched?: string | boolean;
  OperatoryType?: number;
  operatoryType?: string;
}

export interface CalendarColumn {
  id: string;
  name: string;
  shortName: string;
  providerNum?: number;
  operatoryNum: number;
  operatoryName: string;
  role: 'Doctor' | 'Hygienist';
}

export interface OpenDentalQueryParams {
  limit?: number;
  offset?: number;
  since?: string;
  [key: string]: unknown;
}
