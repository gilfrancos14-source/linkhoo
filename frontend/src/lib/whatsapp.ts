const ADMIN_WHATSAPP = '+22997000000';

export function sendWhatsAppReservation(data: {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  roomTitle: string;
  roomPrice: string;
  roomInfo: string;
  dateDebut: string;
  dateFin: string;
  message: string;
}): void {
  const lines = [
    `*Nouvelle demande de réservation*`,
    ``,
    `*Chambre :* ${data.roomTitle}`,
    `*Prix :* ${data.roomPrice}`,
    `*Détails :* ${data.roomInfo}`,
    ``,
    `*Dates souhaitées :*`,
    `Du ${new Date(data.dateDebut).toLocaleDateString('fr-FR')} au ${new Date(data.dateFin).toLocaleDateString('fr-FR')}`,
    ``,
    `*Client :*`,
    `Nom : ${data.clientName}`,
    `Tél : ${data.clientPhone}`,
    `Email : ${data.clientEmail}`,
  ];

  if (data.message) {
    lines.push(``, `*Message :* ${data.message}`);
  }

  const text = encodeURIComponent(lines.join('\n'));
  const phone = ADMIN_WHATSAPP.replace(/[^0-9]/g, '');
  window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
}

export function sendWhatsAppClientResponse(data: {
  clientPhone: string;
  clientName: string;
  roomTitle: string;
  dateDebut: string;
  dateFin: string;
  confirmed: boolean;
}): void {
  const dateStr = data.dateDebut
    ? `du ${new Date(data.dateDebut).toLocaleDateString('fr-FR')} au ${new Date(data.dateFin).toLocaleDateString('fr-FR')}`
    : 'pour les dates demandées';

  const lines = data.confirmed
    ? [
        `*Réservation confirmée*`,
        ``,
        `*Client :* ${data.clientName}`,
        `*Chambre :* ${data.roomTitle}`,
        `*Dates :* ${dateStr}`,
        ``,
        `Merci de contacter le client.`,
      ]
    : [
        `*Réservation non disponible*`,
        ``,
        `*Client :* ${data.clientName}`,
        `*Chambre :* ${data.roomTitle}`,
        `*Dates :* ${dateStr}`,
        ``,
        `Merci d'informer le client.`,
      ];

  const text = encodeURIComponent(lines.join('\n'));
  const phone = ADMIN_WHATSAPP.replace(/[^0-9]/g, '');
  window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
}
