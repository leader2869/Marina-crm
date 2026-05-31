import { Vessel } from '../entities/Vessel';
import { Booking } from '../entities/Booking';

/** Убирает base64-фото из судна в list/detail nested responses */
export function stripVesselForList(vessel: Vessel | null | undefined): Partial<Vessel> | null {
  if (!vessel) {
    return null;
  }
  const { photos: _photos, ...rest } = vessel;
  return { ...rest, photos: null };
}

export function mapBookingListItem(booking: Booking) {
  return {
    ...booking,
    vessel: stripVesselForList(booking.vessel),
    vesselOwner: booking.vesselOwner
      ? {
          id: booking.vesselOwner.id,
          firstName: booking.vesselOwner.firstName,
          lastName: booking.vesselOwner.lastName,
          email: booking.vesselOwner.email,
          phone: booking.vesselOwner.phone,
        }
      : null,
    club: booking.club
      ? {
          id: booking.club.id,
          name: booking.club.name,
          ownerId: (booking.club as { ownerId?: number }).ownerId,
          cashPaymentsEnabled: (booking.club as { cashPaymentsEnabled?: boolean }).cashPaymentsEnabled,
        }
      : null,
    berth: booking.berth
      ? {
          id: booking.berth.id,
          number: booking.berth.number,
        }
      : null,
  };
}
