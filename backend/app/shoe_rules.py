def shoe_usage(initial_km: float, activity_km: float, limit_km: float, manually_worn: bool, retired: bool) -> dict:
    """Estimativa de uso, sem afirmar que a quilometragem mede desgaste fisico."""
    total = round(initial_km + activity_km, 2)
    ratio = total / limit_km
    status = "retired" if retired else "worn" if manually_worn or ratio >= 1 else "attention" if ratio >= 0.8 else "good"
    return {
        "total_km": total,
        "remaining_km": round(max(0, limit_km - total), 2),
        "usage_percent": round(ratio * 100, 2),
        "status": status,
    }
