//! Minimal RFC 3339 parsing (transcript timestamps) without a date crate.

/// Parses `YYYY-MM-DDTHH:MM:SS[.fff][Z|±HH:MM]` into epoch milliseconds.
pub fn parse_rfc3339_ms(s: &str) -> Option<i64> {
    let b = s.as_bytes();
    if b.len() < 19 || b[4] != b'-' || b[7] != b'-' || !matches!(b[10], b'T' | b't' | b' ') {
        return None;
    }
    let num = |from: usize, to: usize| s.get(from..to)?.parse::<i64>().ok();
    let (year, month, day) = (num(0, 4)?, num(5, 7)?, num(8, 10)?);
    let (hour, min, sec) = (num(11, 13)?, num(14, 16)?, num(17, 19)?);
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) || hour > 23 || min > 59 || sec > 60 {
        return None;
    }
    let mut rest = &s[19..];
    let mut millis = 0;
    if let Some(frac) = rest.strip_prefix('.') {
        let digits = frac.bytes().take_while(u8::is_ascii_digit).count();
        let padded = format!("{:0<3}", &frac[..digits.min(3)]);
        millis = padded.parse::<i64>().ok()?;
        rest = &frac[digits..];
    }
    let offset_min = match rest {
        "" | "Z" | "z" => 0,
        _ => {
            let sign = match rest.as_bytes()[0] {
                b'+' => 1,
                b'-' => -1,
                _ => return None,
            };
            let hh = rest.get(1..3)?.parse::<i64>().ok()?;
            let mm = rest.get(rest.len().checked_sub(2)?..)?.parse::<i64>().ok()?;
            sign * (hh * 60 + mm)
        }
    };
    let days = days_from_civil(year, month, day);
    let secs = days * 86_400 + hour * 3_600 + min * 60 + sec - offset_min * 60;
    Some(secs * 1000 + millis)
}

/// Days since 1970-01-01 (Howard Hinnant's algorithm).
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_utc_and_offsets() {
        assert_eq!(parse_rfc3339_ms("1970-01-01T00:00:00Z"), Some(0));
        assert_eq!(parse_rfc3339_ms("2026-09-29T16:45:45.725Z"), Some(1_790_700_345_725));
        assert_eq!(parse_rfc3339_ms("2026-09-29T11:45:45.725-05:00"), Some(1_790_700_345_725));
        assert_eq!(parse_rfc3339_ms("2026-09-29T16:45:45.7Z"), Some(1_790_700_345_700));
        assert_eq!(parse_rfc3339_ms("2000-02-29T00:00:00.123456Z"), Some(951_782_400_123));
    }

    #[test]
    fn rejects_garbage() {
        assert_eq!(parse_rfc3339_ms("yesterday"), None);
        assert_eq!(parse_rfc3339_ms("2026-13-01T00:00:00Z"), None);
        assert_eq!(parse_rfc3339_ms("2026-01-01T00:00:00#"), None);
    }
}
