#!/usr/bin/env python3
import asyncio

from app.seed import seed_for_user


async def main():
    created = await seed_for_user("dev_user_local")
    print("Seed created cases:", created)


if __name__ == "__main__":
    asyncio.run(main())
